/* eslint-disable max-classes-per-file */
const BuildTimeoutReporter = require('./build-timeout-reporter');
const CloudFoundryAPIClient = require('./cloud-foundry-api-client');
const logger = require('./logger');

class TaskStartError extends Error {}

const CUSTOM_MEM = 8 * 1024;

class CFTaskPool {
  constructor({
    buildTimeout, maxTaskMemory, taskAppName, taskAppCommand, taskDisk, taskMemory, url,
    customTaskMemRepos,
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
    this._customTaskMemRepos = customTaskMemRepos;

    this._builds = {};
    this._taskAppGUID = null;
  }

  canStartBuild(build) {
    const requestedMemory = this._requiredMemory(build);
    return this._hasAvailableMemory(requestedMemory);
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

    // All values have to be strings
    e.BUILD_ID = `${e.BUILD_ID}`;
    e.SKIP_LOGGING = `${e.SKIP_LOGGING}`;

    return {
      name: `build-${e.BUILD_ID}`,
      disk_in_mb: this._taskDisk,
      memory_in_mb: this._requiredMemory(build),
      command: `${this._taskAppCommand} '${JSON.stringify(e)}'`,
    };
  }

  _createBuildTimeout(build) {
    return setTimeout(
      () => this._timeoutBuild(build), this._buildTimeout
    );
  }

  async _hasAvailableMemory(requestedMemory) {
    const tasks = await this._apiClient.fetchActiveTasksForApp(this._taskAppGUID);
    const allocMemory = tasks.reduce((mem, task) => mem + task.memory_in_mb, 0);

    return (allocMemory + requestedMemory) < this._maxTaskMemory;
  }

  _timeoutBuild(build) {
    logger.warn('Build %s timed out', build.buildID);
    this.stopBuild(build.buildID);
    this._buildTimeoutReporter.reportBuildTimeout(build);
  }

  _requiredMemory(build) {
    const { OWNER, REPOSITORY } = build.containerEnvironment;
    const repo = `${OWNER}/${REPOSITORY}`.toLowerCase();
    return this._customTaskMemRepos.includes(repo)
      ? CUSTOM_MEM
      : this._taskMemory;
  }
}

CFTaskPool.CUSTOM_MEM = CUSTOM_MEM;

module.exports = CFTaskPool;
