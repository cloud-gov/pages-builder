const { expect } = require('chai');
const BuildScheduler = require('../src/build-scheduler');
const SQSClient = require('../src/sqs-client');

const mockServer = {
  start: () => {},
  stop: () => {},
};

const mockedSQSReceiveMessage = (params, callback) => callback(null, {
  Messages: [],
});

const mockedSQSDeleteMessage = (params, callback) => callback();

const mockBuildQueue = sqs => new SQSClient({
  receiveMessage: mockedSQSReceiveMessage,
  deleteMessage: mockedSQSDeleteMessage,
  ...sqs,
});

const mockBuilderPool = pool => ({
  canStartBuild: () => false,
  start: () => undefined,
  startBuild: () => Promise.resolve(),
  stop: () => undefined,
  stopBuild: () => undefined,
  ...pool,
});

describe('BuildScheduler', () => {
  it('it should start a build when a message is received from SQS and then delete the message', (done) => {
    const sqs = {};

    let hasReceivedMessage = false;
    sqs.receiveMessage = (params, callback) => {
      if (!hasReceivedMessage) {
        hasReceivedMessage = true;
        callback(null, {
          Messages: [
            {
              Body: JSON.stringify({
                environment: [
                  { name: 'OVERRIDE_A', value: 'Value A' },
                ],
              }),
            },
          ],
        });
      } else {
        mockedSQSReceiveMessage(params, callback);
      }
    };

    let hasDeletedMessage = false;
    sqs.deleteMessage = (params, callback) => {
      hasDeletedMessage = true;
      mockedSQSDeleteMessage(params, callback);
    };

    const cluster = {};

    let hasStartedBuild = false;
    cluster.canStartBuild = () => true;
    cluster.startBuild = (build) => {
      expect(build).not.to.be.undefined;
      expect(build.containerEnvironment).to.have.property(
        'OVERRIDE_A',
        'Value A'
      );
      expect(build.containerEnvironment).to.have.property(
        'FEDERALIST_BUILDER_CALLBACK'
      );
      expect(build.buildID).to.be.a('String');

      hasStartedBuild = true;
      return Promise.resolve();
    };

    const buildScheduler = new BuildScheduler(
      mockBuilderPool(cluster),
      mockBuildQueue(sqs),
      mockServer
    );

    buildScheduler.start();

    setImmediate(() => {
      expect(hasReceivedMessage).to.equal(true);
      expect(hasStartedBuild).to.equal(true);
      expect(hasDeletedMessage).to.equal(true);
      buildScheduler.stop();
      done();
    });
  });

  it('should not run more tasks than the cluster can handle', (done) => {
    const sqs = {};

    let receivedMessageCount = 0;
    sqs.receiveMessage = (params, callback) => {
      receivedMessageCount += 1;
      callback(null, {
        Messages: [
          {
            Body: JSON.stringify({
              environment: [
                { name: 'OVERRIDE_A', value: 'Value A' },
              ],
            }),
          },
        ],
      });
    };

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
      mockBuildQueue(sqs),
      mockServer
    );

    buildScheduler.start();

    setTimeout(() => {
      expect(receivedMessageCount).to.be.above(10);
      expect(runningBuildCount).to.equal(10);
      buildScheduler.stop();
      done();
    }, 50);
  });

  it('should not delete the message if the build fails to start', (done) => {
    const sqs = {};

    let hasReceivedMessage = false;
    sqs.receiveMessage = (params, callback) => {
      if (!hasReceivedMessage) {
        hasReceivedMessage = true;
        callback(null, {
          Messages: [
            {
              Body: JSON.stringify({
                environment: [
                  { name: 'OVERRIDE_A', value: 'Value A' },
                ],
              }),
            },
          ],
        });
      } else {
        mockedSQSReceiveMessage(params, callback);
      }
    };

    let hasDeletedMessage = false;
    sqs.deleteMessage = (params, callback) => {
      hasDeletedMessage = true;
      mockedSQSDeleteMessage(params, callback);
    };

    const cluster = {};

    let hasAttemptedToStartedBuild = false;
    cluster.canStartBuild = () => true;
    cluster.startBuild = () => {
      hasAttemptedToStartedBuild = true;
      return Promise.reject(new Error('Test error'));
    };

    const buildScheduler = new BuildScheduler(
      mockBuilderPool(cluster),
      mockBuildQueue(sqs),
      mockServer
    );

    buildScheduler.start();

    setImmediate(() => {
      expect(hasReceivedMessage).to.equal(true);
      expect(hasAttemptedToStartedBuild).to.equal(true);
      expect(hasDeletedMessage).to.equal(false);
      buildScheduler.stop();
      done();
    });
  });
});
