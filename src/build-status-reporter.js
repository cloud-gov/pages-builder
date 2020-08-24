const axios = require('axios');
const logger = require('./logger');

function _request(url, json) {
  return axios.post(url, json);
}

function _sendBuildLogRequest(build, buildLogOutput) {
  logger.verbose(`Sending build log request for ${build.buildID}: ${buildLogOutput}`);

  const url = build.containerEnvironment.LOG_CALLBACK;
  return _request(url, {
    output: Buffer.from(buildLogOutput).toString('base64'),
    source: 'Build scheduler',
  });
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

function reportBuildStatus(build, buildStatus) {
  const buildErrorMsg =  buildStatus === 'error' ? 'The build timed out' : '';

  let buildLogOutput = `Build status updated to ${buildStatus}`;
  if (buildErrorMsg.length) {
    buildLogOutput = `${buildLogOutput}: ${buildErrorMsg}`;
  }

  return Promise.all([
    _sendBuildLogRequest(build, buildLogOutput),
    _sendBuildStatusRequest(build, buildStatus, buildErrorMsg),
  ]).catch((err) => {
    logger.error('Error reporting build status:', err);
  });
}
module.exports = { reportBuildStatus };
