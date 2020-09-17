const axios = require('axios');
const url = require('url');
const appEnv = require('../env');
const CloudFoundryAuthClient = require('./cloud-foundry-auth-client');

const STATE_STARTED = 'STARTED';
const TASK_LABEL = 'build-task';

class CloudFoundryAPIClient {
  constructor() {
    this._authClient = new CloudFoundryAuthClient();
  }

  fetchBuildContainersByLabel() {
    return this._authRequest('GET', '/v3/apps/?label_selector=type==build-container')
      .then(body => body.resources.map(app => ({
        guid: app.guid,
        name: app.name,
        state: app.state,
        containerName: app.metadata.labels.name,
        command: app.metadata.annotations.command,
      })));
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

  fetchActiveTasks() {
    const qs = new URLSearchParams();
    qs.set('states', 'PENDING,RUNNING,CANCELING');
    qs.set('label_selector', `type==${TASK_LABEL}`);

    return this._authRequest('GET', `/v3/tasks?${qs.toString()}`)
      .then(data => data.resources);
  }

  startTaskForApp(task, appGUID) {
    const taskParams = {
      ...task,
      metadata: { labels: { type: TASK_LABEL } },
    };
    return this._authRequest('POST', `/v3/apps/${appGUID}/tasks`, taskParams);
  }

  stopTask(taskGUID) {
    return this._authRequest('POST', `/v3/tasks/${taskGUID}/actions/cancel`);
  }

  async getBuildContainersState() {
    const containerErrors = [];

    const buildContainers = await this.fetchBuildContainersByLabel();

    const numBuildContainers = buildContainers.length;
    const startedContainers = buildContainers.filter(bc => bc.state === STATE_STARTED);
    const numStartedContainers = startedContainers.length;

    if (numStartedContainers !== numBuildContainers) {
      containerErrors.push(`Not all build containers are in the ${STATE_STARTED} state.`);
    }

    const instanceErrors = await this.fetchAllAppInstanceErrors(startedContainers);
    containerErrors.push(...instanceErrors);

    if (containerErrors.length) {
      return { error: containerErrors.join('\n') };
    }

    return {
      found: numBuildContainers,
      started: numStartedContainers,
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

  _authRequest(method, path, json) {
    return this._authClient.accessToken()
      .then(token => this._request(method, path, token, json));
  }
}

module.exports = CloudFoundryAPIClient;
