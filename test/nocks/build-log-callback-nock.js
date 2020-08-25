const nock = require('nock');

const mockBuildLogCallback = (url, output) => {
  const encodedTimeoutMessage = Buffer.from(output).toString('base64');
  const source = 'Build scheduler';

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, { output: encodedTimeoutMessage, source })
    .reply(200);
};

module.exports = mockBuildLogCallback;
