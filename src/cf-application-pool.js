/* eslint-disable max-classes-per-file */
const BuildTimeoutReporter = require('./build-timeout-reporter');
const CloudFoundryAPIClient = require('./cloud-foundry-api-client');
const logger = require('./logger');

class NoContainersAvailableError extends Error {
  constructor() {
    super('Unable to start build because no containers were available');
  }
}

class CFApplicationPool {
  constructor({ buildContainerBaseName, buildTimeout, numBuildContainers }) {
    this._apiClient = new CloudFoundryAPIClient();

    this._buildTimeout = buildTimeout;
    this._buildContainerBaseName = buildContainerBaseName;
    this._numBuildContainers = numBuildContainers;

    this._containers = [];
    this._monitoringCluster = false;
  }

  canStartBuild() {
    return Promise.resolve(this._countAvailableContainers() > 0);
  }

  start() {
    this._monitoringCluster = true;
    return this._monitorCluster();
  }

  startBuild(build) {
    const container = this._firstAvailableContainer();

    if (container) {
      return this._startBuildOnContainer(build, container).then(() => {
        logger.info('Staged build %s on container %s', build.buildID, container.name);
      });
    }
    return Promise.reject(new NoContainersAvailableError());
  }

  stop() {
    this._monitoringCluster = false;
  }

  stopBuild(buildID) {
    logger.info('Stopping build', buildID);

    const container = this._findBuildContainer(buildID);
    if (container) {
      clearTimeout(container.timeout);
      container.build = undefined;
    } else {
      logger.warn('Unable to stop build %s. Container not found.', buildID);
    }
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

  // Returns a resolved promise after one attempt at fetching containers
  // Will never reject, even if there is an error.
  _monitorCluster() {
    if (!this._monitoringCluster) {
      return Promise.resolve();
    }

    return this._apiClient.fetchBuildContainers(
      this._buildContainerBaseName, this._numBuildContainers
    )
      .then((containers) => {
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
      logger.warn('Build %s timed out', build.buildID);
      this._timeoutBuild(build);
    }, this._buildTimeout);
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
    this.stopBuild(build.buildID);
    new BuildTimeoutReporter(build).reportBuildTimeout();
  }
}

module.exports = CFApplicationPool;
