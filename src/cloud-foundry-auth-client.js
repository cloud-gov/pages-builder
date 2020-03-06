const jwt = require('jsonwebtoken');
const axios = require('axios');
const qs = require('querystring');
const appEnv = require('../env');

class CloudFoundryAuthClient {
  constructor() {
    const { username, password } = appEnv.cloudFoundryCreds;
    this._username = username;
    this._password = password;
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

  _fetchNewToken() {
    return this._sendNewTokenRequest()
      .then((token) => {
        this._token = token;
        return token;
      });
  }

  _sendNewTokenRequest() {
    return axios.post(
      appEnv.cloudFoundryOAuthTokenUrl,
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

  _tokenExpired() {
    if (this._token) {
      const decodedToken = jwt.decode(this._token);
      return decodedToken.exp - (Date.now() / 1000) < 5;
    }
    return true;
  }
}

module.exports = CloudFoundryAuthClient;
