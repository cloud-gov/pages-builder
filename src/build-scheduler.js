const Build = require('./build');
const logger = require('./logger');

class BuildScheduler {
  constructor(builderPool, sqsQueue, bullQueue, server) {
    this._builderPool = builderPool;
    this._sqsQueue = sqsQueue;
    this._bullQueue = bullQueue;
    this._server = server;
  }

  start() {
    this._server.start();
    this.running = true;
    this._run();
  }

  stop() {
    this._server.stop();
    this.running = false;
  }

  _run() {
    Promise.all([
      this._findAndScheduleNewBuild(this._bullQueue, true),
      this._findAndScheduleNewBuild(this._sqsQueue),
    ])
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

  async _attemptToStartBuild(build, queue) {
    logger.verbose('Attempting to start build %s', build.federalistBuildId());

    if (await this._builderPool.canStartBuild(build)) {
      return this._startBuildAndDeleteMessage(build, queue);
    }

    logger.info(
      'No resources available for build %s, waiting...',
      build.federalistBuildId()
    );

    return Promise.resolve(null);
  }

  _findAndScheduleNewBuild(queue, isBullQueue = false) {
    logger.verbose('Waiting for message');

    return queue.receiveMessage()
      .then((message) => {
        if (message) {
          logger.verbose('Received message');
          const build = new Build(message, isBullQueue);
          const owner = build.containerEnvironment.OWNER;
          const repo = build.containerEnvironment.REPOSITORY;
          const branch = build.containerEnvironment.BRANCH;
          logger.info('New build %s/%s/%s - %s', owner, repo, branch, build.federalistBuildId());

          return this._attemptToStartBuild(build, queue);
        }
        return null;
      });
  }

  _startBuildAndDeleteMessage(build, queue) {
    logger.verbose('Starting build %s', build.federalistBuildId());

    return this._builderPool.startBuild(build)
      .then(() => queue.deleteMessage(build.queueMessage));
  }
}

module.exports = BuildScheduler;
