const request = require('request');
const url = require('url');
const CloudFoundryAuthClient = require('./cloud-foundry-auth-client');

class CloudFoundryAPIClient {
  constructor() {
    this._authClient = new CloudFoundryAuthClient();
  }

  fetchBuildContainers() {
    return this._authClient.accessToken().then(token => this._request(
        'GET',
        `/v2/spaces/${this._spaceGUID()}/apps`,
        token
      )).then(body => this._filterAppsResponse(JSON.parse(body)));
  }

  updateBuildContainer(container, environment) {
    return this._authClient.accessToken().then(token => this._request(
        'PUT',
        container.url,
        token,
        { environment_json: environment }
      )).then(() => this._authClient.accessToken()).then(token => this._request(
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
    };
  }

  _resolveAPIURL(path) {
    return url.resolve(
      process.env.CLOUD_FOUNDRY_API_HOST,
      path
    );
  }

  _request(method, path, accessToken, json) {
    return new Promise((resolve, reject) => {
      request({
        method: method.toUpperCase(),
        url: this._resolveAPIURL(path),
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        json,
      }, (error, response, body) => {
        if (error) {
          reject(error);
        } else if (response.statusCode > 399) {
          const errorMessage = `Received status code: ${response.statusCode}`;
          reject(new Error(body || errorMessage));
        } else {
          resolve(body);
        }
      });
    });
  }

  _spaceGUID() {
    return process.env.BUILD_SPACE_GUID;
  }
}

module.exports = CloudFoundryAPIClient;
