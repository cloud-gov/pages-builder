/* eslint-disable max-classes-per-file */
const BuildTimeoutReporter = require('./build-timeout-reporter');
const CloudFoundryAPIClient = require('./cloud-foundry-api-client');
const logger = require('./logger');

class TaskStartError extends Error {}

class CFTaskPool {
  constructor({
    buildTimeout, maxTaskMemory, taskAppName, taskAppCommand, taskDisk, taskMemory, url,
  }) {
    this._apiClient = new CloudFoundryAPIClient();
    this._buildTimeoutReporter = BuildTimeoutReporter;

    this._buildTimeout = buildTimeout;
    this._maxTaskMemory = maxTaskMemory;
    this._taskAppName = taskAppName;
    this._taskAppCommand = taskAppCommand;
    this._taskDisk = taskDisk;
    this._taskMemory = taskMemory;
    this._url = url;

    this._builds = {};
    this._taskAppGUID = null;
  }

  canStartBuild() {
    return this._hasAvailableMemory();
  }

  start() {
    return this._setTaskAppGUID(this._taskAppName);
  }

  async startBuild(build) {
    const buildTask = this._buildTask(build);
    try {
      const task = await this._apiClient.startTaskForApp(buildTask, this._taskAppGUID);
      logger.info('Started build %s in task %s guid %s', build.buildID, task.name, task.guid);
      this._builds[build.buildID] = {
        taskGUID: task.guid,
        timeout: this._createBuildTimeout(build),
      };
      return undefined;
    } catch (error) {
      throw new TaskStartError(error.message);
    }
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

    e.BUILDER_CALLBACK = this._url;
    e.STATUS_CALLBACK = this._url;

    return {
      name: `build-${e.BUILD_ID}`,
      disk_in_mb: this._taskDisk,
      memory_in_mb: this._taskMemory,
      command: `${this._taskAppCommand} '${JSON.stringify(e)}'`,
    };
  }

  _createBuildTimeout(build) {
    return setTimeout(
      () => this._timeoutBuild(build), this._buildTimeout
    );
  }

  async _hasAvailableMemory() {
    const tasks = await this._apiClient.fetchActiveTasksForApp(this._taskAppGUID);
    const memory = tasks.reduce((mem, task) => mem + task.memory_in_mb, 0);


    const buffer = this._taskMemory;
    return (memory + buffer) < this._maxTaskMemory;
  }

  _timeoutBuild(build) {
    logger.warn('Build %s timed out', build.buildID);
    this.stopBuild(build.buildID);
    this._buildTimeoutReporter.reportBuildTimeout(build);
  }
}

module.exports = CFTaskPool;
