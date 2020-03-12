const axios = require('axios');

class BuildTimeoutReporter {
  constructor(build) {
    this._build = build;
  }

  reportBuildTimeout() {
    return Promise.all([
      this._sendBuildLogRequest(),
      this._sendBuildStatusRequest(),
    ]).catch((err) => {
      this._build.log(`Error reporting build timeout: ${err}`, 'error');
    });
  }

  _request(url, json) {
    return axios.post(url, json);
  }

  _sendBuildLogRequest() {
    const url = this._build.containerEnvironment.LOG_CALLBACK;
    this._build.log('Sending timeout log request');
    return this._request(url, {
      output: Buffer.from('The build timed out').toString('base64'),
      source: 'Build scheduler',
    });
  }

  _sendBuildStatusRequest() {
    const url = this._build.containerEnvironment.STATUS_CALLBACK;
    this._build.log('Sending timeout status request');
    return this._request(url, {
      message: Buffer.from('The build timed out').toString('base64'),
      status: 'error',
    });
  }
}

module.exports = BuildTimeoutReporter;
