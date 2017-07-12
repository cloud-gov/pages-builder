const expect = require('chai').expect;
const BuildScheduler = require('../src/build-scheduler');

const mockedSQSReceiveMessage = (params, callback) => callback(null, {
  Messages: [],
});

const mockedSQSDeleteMessage = (params, callback) => callback();

const mockSQS = (buildScheduler, sqs) => {
  buildScheduler._sqsClient._sqs = Object.assign({ // eslint-disable-line no-param-reassign
    receiveMessage: mockedSQSReceiveMessage,
    deleteMessage: mockedSQSDeleteMessage,
  }, sqs);
};

const mockCluster = (buildScheduler, cluster) => {
  buildScheduler._cluster = Object.assign({ // eslint-disable-line no-param-reassign
    countAvailableContainers: () => 0,
    start: () => undefined,
    startBuild: () => Promise.resolve(),
    stop: () => undefined,
    stopBuild: () => undefined,
  }, cluster);
};

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
    cluster.countAvailableContainers = () => 1;
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

    const buildScheduler = new BuildScheduler();

    mockSQS(buildScheduler, sqs);
    mockCluster(buildScheduler, cluster);

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
    cluster.countAvailableContainers = () => maxBuildCount - runningBuildCount;
    cluster.startBuild = () => {
      runningBuildCount += 1;
      return Promise.resolve();
    };

    const buildScheduler = new BuildScheduler();

    mockSQS(buildScheduler, sqs);
    mockCluster(buildScheduler, cluster);

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
    cluster.countAvailableContainers = () => 1;
    cluster.startBuild = () => {
      hasAttemptedToStartedBuild = true;
      return Promise.reject(new Error('Test error'));
    };

    const buildScheduler = new BuildScheduler();

    mockSQS(buildScheduler, sqs);
    mockCluster(buildScheduler, cluster);

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
