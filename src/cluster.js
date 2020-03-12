/* eslint-disable max-classes-per-file */
const BuildTimeoutReporter = require('./build-timeout-reporter');
const CloudFoundryAPIClient = require('./cloud-foundry-api-client');
const logger = require('./logger');

class NoContainersAvailableError extends Error {
  constructor() {
    super('Unable to start build because no containers were available');
  }
}

class Cluster {
  constructor() {
    this._containers = [];
    this._monitoringCluster = false;
    this._apiClient = new CloudFoundryAPIClient();
  }

  canStartBuild() {
    return this._countAvailableContainers() > 0;
  }

  start() {
    this._monitoringCluster = true;
    this._monitorCluster();
  }

  startBuild(build) {
    const container = this._firstAvailableContainer();

    if (container) {
      return this._startBuildOnContainer(build, container).then(() => {
        build.log(`Staged on container ${container.name}`, 'info');
      });
    }
    return Promise.reject(new NoContainersAvailableError());
  }

  stop() {
    this._monitoringCluster = false;
  }

  stopBuild(build) {
    build.log('Stopping', 'info');

    const container = this._findBuildContainer(build.buildID);
    if (container) {
      clearTimeout(container.timeout);
      container.build = undefined;
    } else {
      build.log('Unable to stop. Container not found.', 'warn');
    }
  }

  _buildTimeoutMilliseconds() {
    const timeoutSeconds = parseInt(process.env.BUILD_TIMEOUT_SECONDS, 10) || 21 * 60;
    return timeoutSeconds * 1000;
  }

  _countAvailableContainers() {
    return this._containers.filter(container => !container.build).length;
  }

  _firstAvailableContainer() {
    return this._containers.find(container => !container.build);
  }

  _findBuildContainer(buildID) {
    return this._containers.find(container => (
      container.build && container.build.buildID === buildID
    ));
  }

  _findContainer(guid) {
    return this._containers.find(container => container.guid === guid);
  }

  _monitorCluster() {
    if (this._monitoringCluster) {
      this._apiClient.fetchBuildContainers().then((containers) => {
        this._resolveNewContainers(containers);
        logger.info('Cluster monitor: %s container(s) present', this._containers.length);
      }).catch((error) => {
        logger.error(error);
      }).then(() => {
        setTimeout(() => {
          this._monitorCluster();
        }, 60 * 1000);
      });
    }
  }

  _resolveNewContainers(containers) {
    this._containers = containers.map((newContainer) => {
      const existingContainer = this._findContainer(newContainer.guid);

      if (existingContainer) {
        return Object.assign(newContainer, {
          build: existingContainer.build,
          timeout: existingContainer.timeout,
        });
      }
      return newContainer;
    });
  }

  _startBuildOnContainer(build, container) {
    container.build = build; // eslint-disable-line no-param-reassign
    // eslint-disable-next-line no-param-reassign
    container.timeout = setTimeout(() => {
      build.log('Timed out', 'warn');
      this._timeoutBuild(build);
    }, this._buildTimeoutMilliseconds());
    return this._apiClient.updateBuildContainer(
      container,
      build.containerEnvironment
    ).catch((error) => {
      container.build = undefined; // eslint-disable-line no-param-reassign
      clearTimeout(container.timeout);
      throw error;
    });
  }

  _timeoutBuild(build) {
    this.stopBuild(build);
    new BuildTimeoutReporter(build).reportBuildTimeout();
  }

}

module.exports = Cluster;
