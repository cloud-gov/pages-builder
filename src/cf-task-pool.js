/* eslint-disable max-classes-per-file */
const BuildTimeoutReporter = require('./build-timeout-reporter');
const CloudFoundryAPIClient = require('./cloud-foundry-api-client');
const logger = require('./logger');
const appEnv = require('../env');

class TaskStartError extends Error {}

class CFTaskPool {
  constructor({ buildTimeout, taskAppName, taskAppCommand }) {
    this._apiClient = new CloudFoundryAPIClient();
    this._buildTimeout = buildTimeout;
    this._taskAppName = taskAppName;
    this._taskAppCommand = taskAppCommand;

    this._maxMemory = 10240;
    this._maxDisk = 10240;
    this._defaultMemory = 1024;
    this._defaultDisk = 2048;

    this._builds = {};
    this._taskAppGUID = null;
  }

  canStartBuild() {
    return this._hasAvailableMemory();
  }

  start() {
    return this._setTaskAppGUID(this._taskAppName);
  }

  startBuild(build) {
    const buildTask = this._buildTask(build);
    return this._apiClient.startTaskForApp(buildTask, this._taskAppGUID)
      .then((task) => {
        logger.info('Started build %s in task %s guid %s', build.buildID, task.name, task.guid);
        this._builds[build.buildID] = {
          taskGUID: task.guid,
          timeout: this._createBuildTimeout(build),
        };
      })
      .catch(error => new TaskStartError(error.message));
  }

  stop() {
    return true;
  }

  stopBuild(buildID) {
    logger.info('Stopping build', buildID);
    const { taskGUID, timeout } = this._builds[buildID];
    clearTimeout(timeout);
    delete this._builds[buildID];
    return this._apiClient.stopTask(taskGUID)
      .catch(() => {
        // This will fail if the task has already completed
      });
  }

  _setTaskAppGUID(taskAppName) {
    return this._apiClient.fetchAppByName(taskAppName)
      .then((app) => {
        if (!app) {
          throw new Error(`Unable to find application with name: ${taskAppName}`);
        }
        this._taskAppGUID = app.guid;
        return true;
      });
  }

  _buildTask(build) {
    const { containerEnvironment: e } = build;

    e.BUILDER_CALLBACK = appEnv.url;
    e.STATUS_CALLBACK = appEnv.url;

    return {
      name: `build-${e.BUILD_ID}`,
      disk_in_mb: 2048,
      memory_in_mb: 2048,
      command: `${this._taskAppCommand} ${JSON.stringify(e)}`,
    };
  }

  _createBuildTimeout(build) {
    return setTimeout(
      () => this._timeoutBuild(build), this._buildTimeout
    );
  }

  async _hasAvailableMemory() {
    const tasks = await this._apiClient.fetchActiveTasksForApp(this._taskAppGUID);
    const { memory, disk } = tasks.reduce((usage, task) => {
      /* eslint-disable no-param-reassign */
      usage.memory += task.memory_in_mb;
      usage.disk += task.disk_in_mb;
      /* eslint-enable no-param-reassign */
      return usage;
    }, { memory: 0, disk: 0 });

    return (memory + 2 * this._defaultMemory) < this._maxMemory
      && (disk + 2 * this._defaultDisk) < this._maxDisk;
  }

  _timeoutBuild(build) {
    logger.warn('Build %s timed out', build.buildID);
    this.stopBuild(build.buildID);
    new BuildTimeoutReporter(build).reportBuildTimeout();
  }
}

module.exports = CFTaskPool;
