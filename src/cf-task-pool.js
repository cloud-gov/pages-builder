/* eslint-disable max-classes-per-file */
const BuildTimeoutReporter = require('./build-timeout-reporter');
const CloudFoundryAPIClient = require('./cloud-foundry-api-client');
const logger = require('./logger');

class TaskStartError extends Error {}

class CFTaskPool {
  constructor(buildTimeoutMilliseconds, appGUID) {
    this._buildTimeoutMilliseconds = buildTimeoutMilliseconds;
    this._appGUID = appGUID;
    this._builds = {};
    this._apiClient = new CloudFoundryAPIClient();
    this._maxMemory = 10240;
    this._maxDisk = 10240;
    this._defaultMemory = 1024;
    this._defaultDisk = 2048;
  }

  canStartBuild() {
    return this._hasAvailableMemory();
  }

  start() {}

  startBuild(build) {
    const buildTask = this._buildTask(build);
    return this._apiClient.startTaskForApp(buildTask, this._appGUID)
      .then((task) => {
        logger.info('Started build %s in task %s guid %s', build.buildID, task.name, task.guid);
        this._builds[build.buildID] = {
          taskGUID: task.guid,
          timeout: this._createBuildTimeout(build),
        };
      })
      .catch(error => new TaskStartError(error.message));
  }

  stop() {}

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

  _buildTask(build) {
    return {
      name: `build-${build.buildID}`,
      disk_in_mb: 2048,
      memory_in_mb: 2048,
      command: 'python main.py areeeeeegs....',
    };
  }

  _createBuildTimeout(build) {
    return setTimeout(
      () => this._timeoutBuild(build), this._buildTimeoutMilliseconds
    );
  }

  async _hasAvailableMemory() {
    const tasks = await this._apiClient.fetchActiveTasksForApp(this._appGUID);
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
