const nock = require('nock');

const mockBuildStatusCallback = (url, buildStatus, buildErrorMsg = '') => {
  const encodedStatusMessage = Buffer.from(buildErrorMsg).toString('base64');

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, {
      status: buildStatus,
      message: encodedStatusMessage,
    })
    .reply(200);
};

module.exports = mockBuildStatusCallback;
