const axios = require('axios');
const url = require('url');
const CloudFoundryAuthClient = require('./cloud-foundry-auth-client');

const STATE_STARTED = 'STARTED';

const expectedNumBuildContainers = parseInt(process.env.EXPECTED_NUM_BUILD_CONTAINERS, 10);

class CloudFoundryAPIClient {
  constructor() {
    this._authClient = new CloudFoundryAuthClient();
  }

  fetchBuildContainers() {
    return this._authClient.accessToken()
      .then(token => this._request(
        'GET',
        `/v2/spaces/${this._spaceGUID()}/apps`,
        token
      ))
      .then(body => this._filterAppsResponse(body));
  }

  fetchAppStats(appGUID) {
    return this._authClient.accessToken()
      .then(token => this._request(
        'GET',
        `/v2/apps/${appGUID}/stats`,
        token
      ));
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

  getBuildContainersState() {
    const containerErrors = [];
    let numBuildContainers;
    let startedContainers;

    return this.fetchBuildContainers()
      .then((buildContainers) => {
        numBuildContainers = buildContainers.length;
        startedContainers = buildContainers.filter(bc => bc.state === STATE_STARTED);

        if (numBuildContainers < expectedNumBuildContainers) {
          containerErrors.push(`Expected ${expectedNumBuildContainers} build containers but only ${numBuildContainers} found.`);
        }

        if (startedContainers.length !== expectedNumBuildContainers) {
          containerErrors.push(`Not all build containers are in the ${STATE_STARTED} state.`);
        }

        return this.fetchAllAppInstanceErrors(startedContainers);
      })
      .then(instanceErrors => containerErrors.concat(instanceErrors))
      .then((errors) => {
        if (errors.length) {
          return { error: errors.join('\n') };
        }
        return {
          expected: expectedNumBuildContainers,
          found: numBuildContainers,
          started: startedContainers.length,
        };
      });
  }

  updateBuildContainer(container, environment) {
    return this._authClient.accessToken()
      .then(token => this._request(
        'PUT',
        container.url,
        token,
        { environment_json: environment }
      ))
      .then(() => this._authClient.accessToken()).then(token => this._request(
        'POST',
        `${container.url}/restage`,
        token
      ));
  }

  _buildContainerImageName() {
    return process.env.BUILD_CONTAINER_DOCKER_IMAGE_NAME;
  }

  _filterAppsResponse(response) {
    return response.resources
      .map(resource => this._buildContainerFromAppResponse(resource))
      .filter(buildContainer => buildContainer.dockerImage === this._buildContainerImageName());
  }

  _buildContainerFromAppResponse(appResponse) {
    return {
      guid: appResponse.metadata.guid,
      url: appResponse.metadata.url,
      name: appResponse.entity.name,
      dockerImage: appResponse.entity.docker_image,
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
    return url.resolve(
      process.env.CLOUD_FOUNDRY_API_HOST,
      path
    );
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

  _spaceGUID() {
    return process.env.BUILD_SPACE_GUID;
  }
}

module.exports = CloudFoundryAPIClient;
