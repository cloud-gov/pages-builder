const { expect } = require('chai');
const nock = require('nock');
const url = require('url');
const mockBuildLogCallback = require('./nocks/build-log-callback-nock');
const mockBuildStatusCallback = require('./nocks/build-status-callback-nock');
const Build = require('../src/build');

const BuildTimeoutReporter = require('../src/build-timeout-reporter');

describe('BuildTimeoutReporter', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('reportBuildTimeout', () => {
    it("should send a request to the build's status and log callback", (done) => {
      const logURL = url.parse('https://www.example.gov/log');
      const statusURL = url.parse('https://www.example.gov/status');
      const logCallbackNock = mockBuildLogCallback(logURL);
      const statusCallbackNock = mockBuildStatusCallback(statusURL);

      const sqsMessage = {
        Body: JSON.stringify({
          environment: [
            { name: 'LOG_CALLBACK', value: logURL.href },
            { name: 'STATUS_CALLBACK', value: statusURL.href },
            { name: 'BUILD_ID', value: '123abc' },
          ],
          name: 'Conatiner Name',
        }),
      };
      const build = new Build(sqsMessage);

      new BuildTimeoutReporter(build)
        .reportBuildTimeout().then(() => {
          expect(logCallbackNock.isDone()).to.be.true;
          expect(statusCallbackNock.isDone()).to.be.true;
          done();
        }).catch(done);
    });
  });
});
