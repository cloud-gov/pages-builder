const request = require('request');
const winston = require('winston');

class BuildTimeoutReporter {
  constructor(build) {
    this._build = build;
  }

  reportBuildTimeout() {
    return Promise.all([
      this._sendBuildLogRequest(),
      this._sendBuildStatusRequest(),
    ]).catch((err) => {
      winston.error('Error reporting build timeout:', err);
    });
  }

  _request(method, url, json) {
    return new Promise((resolve, reject) => {
      request({
        method: method.toUpperCase(),
        url,
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

  _sendBuildLogRequest() {
    const url = this._build.containerEnvironment.LOG_CALLBACK;
    winston.verbose(`Sending timeout log request for ${this._build.buildID}`);
    return this._request('POST', url, {
      output: Buffer.from('The build timed out').toString('base64'),
      source: 'Build scheduler',
    });
  }

  _sendBuildStatusRequest() {
    const url = this._build.containerEnvironment.STATUS_CALLBACK;
    winston.verbose(`Sending timeout status request for ${this._build.buildID}`);
    return this._request('POST', url, {
      message: Buffer.from('The build timed out').toString('base64'),
      status: 'error',
    });
  }
}

module.exports = BuildTimeoutReporter;
