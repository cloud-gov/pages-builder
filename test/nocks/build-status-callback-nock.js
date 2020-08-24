const nock = require('nock');

const mockBuildStatusCallback = (url, buildStatus) => {
  const timeoutMessage = buildStatus === 'error' ? 'The build timed out' : `Build status updated to ${buildStatus}`;
  const encodedTimeoutMessage = Buffer.from(timeoutMessage).toString('base64');

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, {
      status: buildStatus,
      message: encodedTimeoutMessage,
    })
    .reply(200);
};

module.exports = mockBuildStatusCallback;
