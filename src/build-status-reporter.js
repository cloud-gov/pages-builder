const axios = require('axios');
const logger = require('./logger');

function _request(url, json) {
  return axios.post(url, json);
}

function _sendBuildStatusRequest(build, buildStatus, buildErrorMsg) {
  let logMsg = `Sending ${buildStatus} status request for ${build.buildID}`;
  if (buildErrorMsg.length) {
    logMsg = `${logMsg}: ${buildErrorMsg}`;
  }
  logger.verbose(logMsg);

  const url = build.containerEnvironment.STATUS_CALLBACK;
  return _request(url, {
    message: Buffer.from(buildErrorMsg).toString('base64'),
    status: buildStatus,
  });
}

function reportBuildStatus(build, buildStatus, buildErrorMsg = '') {
  return _sendBuildStatusRequest(build, buildStatus, buildErrorMsg)
    .catch((err) => {
      logger.error('Error reporting build status:', err);
    });
}
module.exports = { reportBuildStatus };
