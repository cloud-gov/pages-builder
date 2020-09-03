const Build = require('./build');
const logger = require('./logger');

class BuildScheduler {
  constructor(builderPool, buildQueue, server) {
    this._builderPool = builderPool;
    this._buildQueue = buildQueue;
    this._server = server;
  }

  start() {
    this._server.start();
    this.running = true;
    this._run();
  }

  stop() {
    this._server.stop();
    this._builderPool.stop();
    this.running = false;
  }

  _run() {
    this._findAndScheduleNewBuild()
      .catch((error) => {
        logger.error(error);
      })
      .then(() => {
        if (this.running) {
          setImmediate(() => {
            this._run();
          });
        }
      });
  }

  async _attemptToStartBuild(build) {
    logger.verbose('Attempting to start build');

    if (await this._builderPool.canStartBuild(build)) {
      return this._startBuildAndDeleteMessage(build);
    }

    logger.info(
      'No resources available for build %s, waiting...',
      build.buildID
    );

    return Promise.resolve(null);
  }

  _findAndScheduleNewBuild() {
    logger.verbose('Waiting for message');

    return this._buildQueue.receiveMessage()
      .then((message) => {
        if (message) {
          logger.verbose('Received message');
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

    return this._builderPool.startBuild(build)
      .then(() => this._buildQueue.deleteMessage(build.sqsMessage));
  }
}

module.exports = BuildScheduler;
