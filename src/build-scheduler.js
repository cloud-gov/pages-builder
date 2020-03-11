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

  _logBuild(msg, build, level = 'verbose') {
    const body = `${msg}: build@%s/%s/%s@id=%s - %s`;
    const owner = build.containerEnvironment.OWNER;
    const repo = build.containerEnvironment.REPOSITORY;
    const branch = build.containerEnvironment.BRANCH;
    const federalistBuildId = build.containerEnvironment.BUILD_ID;
    const buildId = build.buildID;
    if (level === 'error') {
      logger.error(body, owner, repo, branch, federalistBuildId, buildId);
    } else if (level === 'info') {
      logger.info(body, owner, repo, branch, federalistBuildId, buildId);
    } else {
      logger.verbose(body, owner, repo, branch, federalistBuildId, buildId);
    }
  }

  _attemptToStartBuild(build) {
    this._logBuild('Attempting to start', build);

    if (this._builderPool.canStartBuild()) {
      return this._startBuildAndDeleteMessage(build);
    }
    this._logBuild('No containers available. Stopping build and waiting', build);
    return null;
  }

  _findAndScheduleNewBuild() {
    logger.verbose('Receiving message');

    return this._buildQueue.receiveMessage().then((message) => {
      if (message) {
        const build = new Build(message);
        this._logBuild('New Build', build, 'info');
        return this._attemptToStartBuild(build);
      }
      return null;
    });
  }

  _startBuildAndDeleteMessage(build) {
    this._logBuild('Starting', build);

    return this._builderPool.startBuild(build)
      .then(() => this._buildQueue.deleteMessage(build.sqsMessage));
  }
}

module.exports = BuildScheduler;
