const { expect } = require('chai');
const BuildScheduler = require('../src/build-scheduler');
const QueueClient = require('../src/queue-client');
const SQSClient = require('../src/sqs-client');

const mockServer = {
  start: () => {},
  stop: () => {},
};

const mockedSQSReceiveMessage = (params, callback) => callback(null, {
  Messages: [],
});

const mockedSQSDeleteMessage = (params, callback) => callback();

const mockBuildSQSQueue = sqs => new SQSClient({
  receiveMessage: mockedSQSReceiveMessage,
  deleteMessage: mockedSQSDeleteMessage,
  ...sqs,
});

const mockedBullReceiveMessage = () => new Promise((resolve) => { resolve({}); });
const mockedBullDeleteMessage = () => new Promise((resolve) => { resolve({}); });

const mockBuildBullQueue = bull => new QueueClient({
  getNextJob: mockedBullReceiveMessage,
  getJob: mockedBullDeleteMessage,
  ...bull,
});

const mockBuilderPool = pool => ({
  canStartBuild: () => false,
  start: () => undefined,
  startBuild: () => Promise.resolve(),
  ...pool,
});

describe('BuildScheduler', () => {
  it('it should start a build when a message is received from SQS and then delete the message', (done) => {
    const sqs = {
      extractMessageData(message) {
        return JSON.parse(message.Body);
      },
    };
    const bull = {
      extractMessageData(message) {
        return message.data;
      },
    };
    const data = {
      environment: [
        { name: 'OVERRIDE_A', value: 'Value A' },
      ],
    };

    let hasReceivedSQSMessage = false;
    sqs.receiveMessage = (params, callback) => {
      if (!hasReceivedSQSMessage) {
        hasReceivedSQSMessage = true;
        callback(null, {
          Messages: [
            {
              Body: JSON.stringify(data),
            },
          ],
        });
      } else {
        mockedSQSReceiveMessage(params, callback);
      }
    };

    let hasReceivedBullMessage = false;
    bull.receiveMessage = () => new Promise((resolve) => {
      if (!hasReceivedBullMessage) {
        hasReceivedBullMessage = true;
        resolve({
          id: 'bull-job-1',
          data,
        });
      } else {
        resolve({});
      }
    });

    let hasDeletedSQSMessage = false;
    sqs.deleteMessage = (params, callback) => {
      hasDeletedSQSMessage = true;
      mockedSQSDeleteMessage(params, callback);
    };

    let hasDeletedBullMessage = false;
    bull.deleteMessage = () => new Promise((resolve) => {
      hasDeletedBullMessage = true;
      resolve();
    });

    const cluster = {};

    let hasStartedBuild = false;
    cluster.canStartBuild = () => true;
    cluster.startBuild = (build) => {
      expect(build).not.to.be.undefined;
      expect(build.containerEnvironment).to.have.property(
        'OVERRIDE_A',
        'Value A'
      );
      expect(build.buildID).to.be.a('String');

      hasStartedBuild = true;
      return Promise.resolve();
    };

    const buildScheduler = new BuildScheduler(
      mockBuilderPool(cluster),
      [mockBuildSQSQueue(sqs), bull],
      mockServer
    );

    buildScheduler.start();

    setImmediate(() => {
      expect(hasReceivedSQSMessage).to.equal(true);
      expect(hasReceivedBullMessage).to.equal(true);
      expect(hasStartedBuild).to.equal(true);
      expect(hasDeletedSQSMessage).to.equal(true);
      expect(hasDeletedBullMessage).to.equal(true);
      buildScheduler.stop();
      done();
    });
  });

  it('should not run more tasks than the cluster can handle', (done) => {
    const sqs = {};
    const bull = {};
    const data = {
      environment: [
        { name: 'OVERRIDE_A', value: 'Value A' },
      ],
    };

    let receivedSQSMessageCount = 0;
    sqs.receiveMessage = (params, callback) => {
      receivedSQSMessageCount += 1;
      callback(null, {
        Messages: [
          {
            Body: JSON.stringify(data),
          },
        ],
      });
    };

    let receivedBullMessageCount = 0;
    bull.receiveMessage = () => new Promise((resolve) => {
      receivedBullMessageCount += 1;
      resolve({
        id: 'bull-job-2',
        data,
      });
    });

    bull.deleteMessage = () => new Promise((resolve) => {
      receivedBullMessageCount += 1;
      resolve();
    });

    const cluster = {};

    let runningBuildCount = 0;
    const maxBuildCount = 10;
    cluster.canStartBuild = () => maxBuildCount - runningBuildCount > 0;
    cluster.startBuild = () => {
      runningBuildCount += 1;
      return Promise.resolve();
    };

    const buildScheduler = new BuildScheduler(
      mockBuilderPool(cluster),
      [mockBuildSQSQueue(sqs), bull],
      mockServer
    );

    buildScheduler.start();

    setTimeout(() => {
      expect(receivedSQSMessageCount).to.be.above(10);
      expect(receivedBullMessageCount).to.be.above(10);
      expect(runningBuildCount).to.equal(10);
      buildScheduler.stop();
      done();
    }, 90);
  });

  it('should not delete the message if the build fails to start', (done) => {
    const sqs = {};
    const bull = {};
    const data = {
      environment: [
        { name: 'OVERRIDE_A', value: 'Value A' },
      ],
    };

    let hasReceivedSQSMessage = false;
    sqs.receiveMessage = (params, callback) => {
      if (!hasReceivedSQSMessage) {
        hasReceivedSQSMessage = true;
        callback(null, {
          Messages: [
            {
              Body: JSON.stringify(data),
            },
          ],
        });
      } else {
        mockedSQSReceiveMessage(params, callback);
      }
    };

    let hasReceivedBullMessage = false;
    bull.getNextJob = () => new Promise((resolve) => {
      if (!hasReceivedBullMessage) {
        hasReceivedBullMessage = true;
        resolve({
          id: 'bull-job-1',
          data,
        });
      }
      resolve();
    });

    let hasDeletedSQSMessage = false;
    sqs.deleteMessage = (params, callback) => {
      hasDeletedSQSMessage = true;
      mockedSQSDeleteMessage(params, callback);
    };

    let hasDeletedBullMessage = false;
    bull.getJob = () => new Promise((resolve) => {
      hasDeletedBullMessage = true;
      resolve();
    });

    const cluster = {};

    let hasAttemptedToStartedBuild = false;
    cluster.canStartBuild = () => true;
    cluster.startBuild = () => {
      hasAttemptedToStartedBuild = true;
      return Promise.reject(new Error('Test error'));
    };

    const buildScheduler = new BuildScheduler(
      mockBuilderPool(cluster),
      [mockBuildSQSQueue(sqs), mockBuildBullQueue(bull)],
      mockServer
    );

    buildScheduler.start();

    setImmediate(() => {
      expect(hasReceivedSQSMessage).to.equal(true);
      expect(hasReceivedBullMessage).to.equal(true);
      expect(hasAttemptedToStartedBuild).to.equal(true);
      expect(hasDeletedSQSMessage).to.equal(false);
      expect(hasDeletedBullMessage).to.equal(false);
      buildScheduler.stop();
      done();
    });
  });
});
