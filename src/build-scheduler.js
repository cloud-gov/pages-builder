const Build = require('./build');
const Cluster = require('./cluster');
const SQSClient = require('./sqs-client');
const logger = require('./logger');

class BuildScheduler {
  constructor() {
    this._cluster = new Cluster();
    this._sqsClient = new SQSClient();
  }

  start() {
    this._cluster.start();
    this.running = true;
    this._run();
  }

  stop() {
    this._cluster.stop();
    this.running = false;
  }

  _run() {
    this._findAndScheduleNewBuild().catch((error) => {
      logger.error(error);
    }).then(() => {
      if (this.running) {
        setImmediate(() => {
          this._run();
        });
      }
    });
  }

  _attemptToStartBuild(build) {
    logger.verbose('Attempting to start build');

    if (this._cluster.countAvailableContainers() > 0) {
      return this._startBuildAndDeleteMessage(build);
    }
    logger.info(
      'No containers available. Stopping build %s and waiting',
      build.buildID
    );
    return null;
  }

  _findAndScheduleNewBuild() {
    logger.verbose('Receiving message');

    return this._sqsClient.receiveMessage().then((message) => {
      if (message) {
        const build = new Build(message);
        const owner = build.containerEnvironment.OWNER;
        const repo = build.containerEnvironment.REPOSITORY;
        const branch = build.containerEnvironment.BRANCH;
        logger.info('New build %s/%s/%s - %s', owner, repo, branch, build.buildID);

        return this._attemptToStartBuild(build);
      }
      return null;
    });
  }

  _startBuildAndDeleteMessage(build) {
    logger.verbose('Starting build');

    return this._cluster.startBuild(build)
      .then(() => this._sqsClient.deleteMessage(build.sqsMessage));
  }
}

module.exports = BuildScheduler;
