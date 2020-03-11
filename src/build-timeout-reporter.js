const axios = require('axios');
const logger = require('./logger');

class BuildTimeoutReporter {
  constructor(build) {
    this._build = build;
  }

  reportBuildTimeout() {
    return Promise.all([
      this._sendBuildLogRequest(),
      this._sendBuildStatusRequest(),
    ]).catch((err) => {
      this._logBuild(`Error reporting build timeout: ${err}`, 'error');
    });
  }

  _request(url, json) {
    return axios.post(url, json);
  }

  _logBuild(msg, level = 'verbose') {
    const body = `${msg} for build@id=%s - %s`;
    const federalistBuildId = this._build.containerEnvironment.BUILD_ID;
    const buildId = this._build.buildID;
    if (level === 'error') {
      logger.error(body, federalistBuildId, buildId);
    } else {
      logger.verbose(body, federalistBuildId, buildId);
    }
  }

  _sendBuildLogRequest() {
    const url = this._build.containerEnvironment.LOG_CALLBACK;
    this._logBuild('Sending timeout log request');
    return this._request(url, {
      output: Buffer.from('The build timed out').toString('base64'),
      source: 'Build scheduler',
    });
  }

  _sendBuildStatusRequest() {
    const url = this._build.containerEnvironment.STATUS_CALLBACK;
    this._logBuild('Sending timeout status request');
    return this._request(url, {
      message: Buffer.from('The build timed out').toString('base64'),
      status: 'error',
    });
  }
}

module.exports = BuildTimeoutReporter;
