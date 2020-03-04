const jwt = require('jsonwebtoken');
const request = require('request');
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
    return this._sendNewTokenRequest().then((token) => {
      this._token = token;
      return token;
    });
  }

  _sendNewTokenRequest() {
    return new Promise((resolve, reject) => {
      request.post({
        url: appEnv.cloudFoundryOAuthTokenUrl,
        auth: {
          username: 'cf',
          password: '',
        },
        form: {
          grant_type: 'password',
          username: this._username,
          password: this._password,
          response_type: 'token',
        },
      }, (error, response, body) => {
        if (error) {
          reject(error);
        } else if (response.statusCode > 399) {
          const errorMessage = `Received status code: ${response.statusCode}`;
          reject(new Error(body || errorMessage));
        } else {
          resolve(JSON.parse(body).access_token);
        }
      });
    });
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
