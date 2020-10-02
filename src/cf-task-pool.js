/* eslint-disable max-classes-per-file */
const BuildStatusReporter = require('./build-status-reporter');
const CloudFoundryAPIClient = require('./cloud-foundry-api-client');
const logger = require('./logger');

class TaskStartError extends Error {}

class CFTaskPool {
  constructor({
    maxTaskMemory, taskDisk, taskMemory, url,
    customTaskMemRepos, taskCustomMemory, taskCustomDisk,
  }) {
    this._apiClient = new CloudFoundryAPIClient();
    this._buildStatusReporter = BuildStatusReporter;

    this._maxTaskMemory = maxTaskMemory;
    this._taskDisk = taskDisk;
    this._taskMemory = taskMemory;
    this._url = url;
    this._customTaskMemRepos = customTaskMemRepos;
    this._taskCustomMemory = taskCustomMemory;
    this._taskCustomDisk = taskCustomDisk;
  }

  canStartBuild(build) {
    const requestedMemory = this._containerSize(build).memory_in_mb;
    return this._hasAvailableMemory(requestedMemory);
  }

  async startBuild(build) {
    const containers = await this._apiClient.fetchBuildContainersByLabel();
    if (containers.length < 1) {
      throw new TaskStartError('No build containers exist in this space.');
    }

    const containerName = build.containerName || 'default';
    const container = containers.find(c => c.containerName === containerName);
    if (!container) {
      throw new TaskStartError(`Could not find build container with name: "${containerName}"`);
    }

    const buildTask = this._buildTask(build, container.command);

    try {
      const task = await this._apiClient.startTaskForApp(buildTask, container.guid);
      logger.info('Started build %s in task %s guid %s', build.buildID, task.name, task.guid);
      this._buildStatusReporter.reportBuildStatus(build, 'tasked');
      return undefined;
    } catch (error) {
      throw new TaskStartError(error.message);
    }
  }

  _buildTask(build, command) {
    const { containerEnvironment } = build;

    const params = JSON.stringify(containerEnvironment);
    const size = this._containerSize(build);

    return {
      name: `build-${containerEnvironment.BUILD_ID}`,
      ...size,
      command: `${command} '${params}'`,
    };
  }

  async _hasAvailableMemory(requestedMemory) {
    const tasks = await this._apiClient.fetchActiveTasks();
    const allocMemory = tasks.reduce((mem, task) => mem + task.memory_in_mb, 0);

    return (allocMemory + requestedMemory) < this._maxTaskMemory;
  }

  _requiresCustom(build) {
    const { OWNER, REPOSITORY } = build.containerEnvironment;
    const repo = `${OWNER}/${REPOSITORY}`.toLowerCase();
    return this._customTaskMemRepos.includes(repo);
  }

  _containerSize(build) {
    const isLargeContainer = (build.containerSize === 'large') || this._requiresCustom(build);
    return {
      disk_in_mb: isLargeContainer ? this._taskCustomDisk : this._taskDisk,
      memory_in_mb: isLargeContainer ? this._taskCustomMemory : this._taskMemory,
    };
  }
}

module.exports = CFTaskPool;
