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
    build.log('Attempting to start');

    if (this._builderPool.canStartBuild()) {
      return this._startBuildAndDeleteMessage(build);
    }
    build.log('No containers available. Stopping build and waiting');
    return null;
  }

  _findAndScheduleNewBuild() {
    logger.verbose('Receiving message');

    return this._buildQueue.receiveMessage().then((message) => {
      if (message) {
        const build = new Build(message);
        build.log('New Build', 'info');
        return this._attemptToStartBuild(build);
      }
      return null;
    });
  }

  _startBuildAndDeleteMessage(build) {
    build.log('Starting');

    return this._builderPool.startBuild(build)
      .then(() => this._buildQueue.deleteMessage(build.sqsMessage));
  }
}

module.exports = BuildScheduler;
