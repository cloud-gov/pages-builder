const axios = require('axios');
const logger = require('./logger');

function _request(url, json) {
  return axios.post(url, json);
}

function _sendBuildLogRequest(build) {
  const url = build.containerEnvironment.LOG_CALLBACK;
  logger.verbose(`Sending timeout log request for ${build.buildID}`);
  return _request(url, {
    output: Buffer.from('The build timed out').toString('base64'),
    source: 'Build scheduler',
  });
}

function _sendBuildStatusRequest(build) {
  const url = build.containerEnvironment.STATUS_CALLBACK;
  logger.verbose(`Sending timeout status request for ${build.buildID}`);
  return _request(url, {
    message: Buffer.from('The build timed out').toString('base64'),
    status: 'error',
  });
}

function reportBuildTimeout(build) {
  return Promise.all([
    _sendBuildLogRequest(build),
    _sendBuildStatusRequest(build),
  ]).catch((err) => {
    logger.error('Error reporting build timeout:', err);
  });
}

module.exports = { reportBuildTimeout };
