const Build = require('./build');
const logger = require('./logger');

class BuildScheduler {
  constructor(builderPool, queues, server) {
    this._builderPool = builderPool;
    this._queues = queues;
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
    Promise.all(
      this._queues.map(queue => this._findAndScheduleNewBuild(queue))
    )
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

  async _attemptToStartBuild(build, queue, message) {
    logger.verbose('Attempting to start build %s', build.pagesBuildId());

    if (await this._builderPool.canStartBuild(build)) {
      return this._startBuildAndDeleteMessage(build, queue, message);
    }

    logger.info(
      'No resources available for build %s, waiting...',
      build.pagesBuildId()
    );

    return Promise.resolve(null);
  }

  _findAndScheduleNewBuild(queue) {
    logger.verbose('Waiting for message');

    return queue.receiveMessage()
      .then((message) => {
        if (message) {
          logger.verbose('Received message');
          const build = new Build(queue.extractMessageData(message));
          const { BRANCH, OWNER, REPOSITORY } = build.containerEnvironment;
          logger.info('New build %s/%s/%s - %s', OWNER, REPOSITORY, BRANCH, build.pagesBuildId());

          return this._attemptToStartBuild(build, queue, message);
        }
        return null;
      });
  }

  _startBuildAndDeleteMessage(build, queue, message) {
    logger.verbose('Starting build %s', build.pagesBuildId());

    return this._builderPool.startBuild(build)
      .then(() => queue.deleteMessage(message));
  }
}

module.exports = BuildScheduler;
