const jwt = require('jsonwebtoken');
const axios = require('axios');
const qs = require('querystring');
const appEnv = require('../env');

class CloudFoundryAuthClient {
  constructor() {
    const {
      DEPLOY_USER_USERNAME,
      DEPLOY_USER_PASSWORD,
      username,
      password,
    } = this._cloudFoundryCredentials();

    this._username = DEPLOY_USER_USERNAME || username;
    this._password = DEPLOY_USER_PASSWORD || password;
    this._token = '';
  }

  accessToken() {
    return new Promise((resolve) => {
      if (this._tokenExpired()) {
        resolve(this._fetchNewToken());
      } else {
        resolve(this._token);
      }
    });
  }

  _cloudFoundryCredentials() {
    const cloudFoundryCredentials = appEnv.getServiceCreds('federalist-deploy-user');

    if (cloudFoundryCredentials) {
      return cloudFoundryCredentials;
    }
    return {
      DEPLOY_USER_USERNAME: process.env.DEPLOY_USER_USERNAME,
      DEPLOY_USER_PASSWORD: process.env.DEPLOY_USER_PASSWORD,
    };
  }

  _fetchNewToken() {
    return this._sendNewTokenRequest().then((token) => {
      this._token = token;
      return token;
    });
  }

  _sendNewTokenRequest() {
    return axios.post(
      this._tokenEndpoint(),
      qs.stringify({
        grant_type: 'password',
        username: this._username,
        password: this._password,
        response_type: 'token',
      }),
      {
        auth: {
          username: 'cf',
          password: '',
        },
      }
    )
      .then(response => response.data.access_token);
  }

  _tokenEndpoint() {
    return process.env.CLOUD_FOUNDRY_OAUTH_TOKEN_URL;
  }

  _tokenExpired() {
    if (this._token) {
      const decodedToken = jwt.decode(this._token);
      return decodedToken.exp - (Date.now() / 1000) < 5;
    }
    return true;
  }
}

module.exports = CloudFoundryAuthClient;
