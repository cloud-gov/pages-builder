const axios = require('axios');
const url = require('url');
const appEnv = require('../env');
const CloudFoundryAuthClient = require('./cloud-foundry-auth-client');

const STATE_STARTED = 'STARTED';

class CloudFoundryAPIClient {
  constructor() {
    this._authClient = new CloudFoundryAuthClient();
  }

  fetchBuildContainers(buildContainerBaseName, numBuildContainers) {
    return this._authRequest('GET', `/v2/spaces/${appEnv.spaceGUID}/apps`)
      .then(body => this._filterAppsResponse(buildContainerBaseName, numBuildContainers, body));
  }

  fetchAppStats(appGUID) {
    return this._authRequest('GET', `/v2/apps/${appGUID}/stats`);
  }

  fetchAppInstanceStates(container) {
    return this.fetchAppStats(container.guid)
      .then(stats => ({
        guid: container.guid,
        name: container.name,
        states: this._appInstanceStates(stats),
      }));
  }

  fetchAllAppInstanceErrors(buildContainers) {
    const instanceErrors = [];
    let states;
    const promises = buildContainers.map(container => this.fetchAppInstanceStates(container));

    return Promise.all(promises)
      .then((instanceStates) => {
        instanceStates.forEach((instanceState) => {
          states = instanceState.states;
          if (states.CRASHED || states.DOWN || states.FLAPPING || states.UNKNOWN) {
            instanceErrors.push(`${instanceState.name}:\tNot all instances for are running. ${JSON.stringify(states)}`);
          } else if (Object.keys(states).length === 0) {
            instanceErrors.push(`${instanceState.name} has 0 running instances`);
          }
        });
        return instanceErrors;
      });
  }

  // Assumes credentials only have access to the current space
  fetchAppByName(appName) {
    const params = `names=${appName}`;
    return this._authRequest('GET', `/v3/apps?${params}`)
      .then(data => data.resources.find(app => app.name === appName));
  }

  fetchActiveTasksForApp(appGUID) {
    const params = 'states=PENDING,RUNNING,CANCELING';
    return this._authRequest('GET', `/v3/apps/${appGUID}/tasks?${params}`)
      .then(data => data.resources);
  }

  startTaskForApp(task, appGUID) {
    return this._authRequest('POST', `/v3/apps/${appGUID}/tasks`, task);
  }

  stopTask(taskGUID) {
    return this._authRequest('POST', `/v3/tasks/${taskGUID}/actions/cancel`);
  }

  getBuildContainersState(buildContainerBaseName, numBuildContainers) {
    const containerErrors = [];
    let _numBuildContainers;
    let _startedContainers;

    return this.fetchBuildContainers(buildContainerBaseName, numBuildContainers)
      .then((buildContainers) => {
        _numBuildContainers = buildContainers.length;
        _startedContainers = buildContainers.filter(bc => bc.state === STATE_STARTED);

        if (_numBuildContainers < numBuildContainers) {
          containerErrors.push(`Expected ${numBuildContainers} build containers but only ${_numBuildContainers} found.`);
        }

        if (_startedContainers.length !== numBuildContainers) {
          containerErrors.push(`Not all build containers are in the ${STATE_STARTED} state.`);
        }

        return this.fetchAllAppInstanceErrors(_startedContainers);
      })
      .then(instanceErrors => containerErrors.concat(instanceErrors))
      .then((errors) => {
        if (errors.length) {
          return { error: errors.join('\n') };
        }
        return {
          expected: numBuildContainers,
          found: _numBuildContainers,
          started: _startedContainers.length,
        };
      });
  }

  updateBuildContainer(container, environment) {
    return this._authRequest(
      'PUT',
      container.url,
      { environment_json: environment }
    )
      .then(() => this._authRequest('POST', `${container.url}/restage`));
  }

  _buildContainerNames(buildContainerBaseName, numBuildContainers) {
    if (numBuildContainers <= 1) {
      return [buildContainerBaseName];
    }

    return Array(numBuildContainers)
      .fill()
      .map((_, idx) => `${buildContainerBaseName}-${idx + 1}`);
  }

  _filterAppsResponse(buildContainerBaseName, numBuildContainers, response) {
    return response.resources
      .map(resource => this._buildContainerFromAppResponse(resource))
      .filter(buildContainer => this._buildContainerNames(buildContainerBaseName, numBuildContainers)
        .includes(buildContainer.name));
  }

  _buildContainerFromAppResponse(appResponse) {
    return {
      guid: appResponse.metadata.guid,
      url: appResponse.metadata.url,
      name: appResponse.entity.name,
      state: appResponse.entity.state,
    };
  }

  _appInstanceStates(statsResponse) {
    const instances = Object.keys(statsResponse).map(i => statsResponse[i]);
    const statesCount = {};

    instances.forEach((instance) => {
      if (statesCount[instance.state]) {
        statesCount[instance.state] += 1;
      } else {
        statesCount[instance.state] = 1;
      }
    });
    return statesCount;
  }

  _resolveAPIURL(path) {
    return url.resolve(appEnv.cloudFoundryApiHost, path);
  }

  _request(method, path, accessToken, json) {
    return axios({
      method: method.toUpperCase(),
      url: this._resolveAPIURL(path),
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: json,
    })
      .then(response => response.data);
  }

  _numBuildContainers() {
    return parseInt(process.env.NUM_BUILD_CONTAINERS, 10);
  }

  _authRequest(method, path, json) {
    return this._authClient.accessToken()
      .then(token => this._request(method, path, token, json));
  }
}

module.exports = CloudFoundryAPIClient;
