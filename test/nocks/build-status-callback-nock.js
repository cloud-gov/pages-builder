const nock = require('nock');

const mockBuildStatusCallback = (url, buildStatus) => {
  const statusMessage = buildStatus === 'error' ? 'The build timed out' : '';
  const encodedStatusMessage = Buffer.from(statusMessage).toString('base64');

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, {
      status: buildStatus,
      message: encodedStatusMessage,
    })
    .reply(200);
};

module.exports = mockBuildStatusCallback;
