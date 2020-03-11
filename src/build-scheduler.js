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
    this._builderPool.start();
    this.running = true;
    this._run();
  }

  stop() {
    this._server.stop();
    this._builderPool.stop();
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
    logger.verbose('Attempting to start build@id=%s - %s',
      build.containerEnvironment.BUILD_ID,
      build.buildID
    );

    if (this._builderPool.canStartBuild()) {
      return this._startBuildAndDeleteMessage(build);
    }
    logger.info(
      'No containers available. Stopping build@id=%s - %s and waiting',
      build.containerEnvironment.BUILD_ID,
      build.buildID
    );
    return null;
  }

  _findAndScheduleNewBuild() {
    logger.verbose('Receiving message');

    return this._buildQueue.receiveMessage().then((message) => {
      if (message) {
        const build = new Build(message);
        const owner = build.containerEnvironment.OWNER;
        const repo = build.containerEnvironment.REPOSITORY;
        const branch = build.containerEnvironment.BRANCH;
        const buildId = build.containerEnvironment.BUILD_ID;
        logger.info('New build %s/%s/%s@id=%s - %s', owner, repo, branch, buildId, build.buildID);

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
