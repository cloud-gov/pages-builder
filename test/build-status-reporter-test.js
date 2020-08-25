const { expect } = require('chai');
const nock = require('nock');
const url = require('url');
const mockBuildLogCallback = require('./nocks/build-log-callback-nock');
const mockBuildStatusCallback = require('./nocks/build-status-callback-nock');

const BuildStatusReporter = require('../src/build-status-reporter');

describe('BuildStatusReporter', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('reportBuildStatus @buildStatus=error', () => {
    it("should send a request to the build's status and log callback", async () => {
      const buildStatus = 'error';
      const logOutput = `Build status updated to ${buildStatus}: The build timed out`;
      const logURL = url.parse('https://www.example.gov/log');
      const statusURL = url.parse('https://www.example.gov/status');
      const logCallbackNock = mockBuildLogCallback(logURL, logOutput);
      const statusCallbackNock = mockBuildStatusCallback(statusURL, buildStatus);

      const build = {
        containerEnvironment: {
          LOG_CALLBACK: logURL.href,
          STATUS_CALLBACK: statusURL.href,
        },
      };

      await BuildStatusReporter.reportBuildStatus(build, 'error');
      expect(logCallbackNock.isDone()).to.be.true;
      expect(statusCallbackNock.isDone()).to.be.true;
    });
  });

  describe('reportBuildStatus @buildStatus <> error', () => {
    it("should send a request to the build's status and log callback", async () => {
      const buildStatus = 'testStatus';
      const logOutput = `Build status updated to ${buildStatus}`;
      const logURL = url.parse('https://www.example.gov/log');
      const statusURL = url.parse('https://www.example.gov/status');
      const logCallbackNock = mockBuildLogCallback(logURL, logOutput);
      const statusCallbackNock = mockBuildStatusCallback(statusURL, buildStatus);

      const build = {
        containerEnvironment: {
          LOG_CALLBACK: logURL.href,
          STATUS_CALLBACK: statusURL.href,
        },
      };

      await BuildStatusReporter.reportBuildStatus(build, buildStatus);
      expect(logCallbackNock.isDone()).to.be.true;
      expect(statusCallbackNock.isDone()).to.be.true;
    });
  });
});
