const { expect } = require('chai');
const nock = require('nock');
const url = require('url');

const mockBuildStatusCallback = require('./nocks/build-status-callback-nock');
const BuildStatusReporter = require('../src/build-status-reporter');

describe('BuildStatusReporter', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('reportBuildStatus @buildStatus=error', () => {
    it("should send a request to the build's status callback", async () => {
      const buildStatus = 'error';
      const statusURL = url.parse('https://www.example.gov/status');
      const statusCallbackNock = mockBuildStatusCallback(statusURL, buildStatus);

      const build = {
        containerEnvironment: {
          STATUS_CALLBACK: statusURL.href,
        },
      };

      await BuildStatusReporter.reportBuildStatus(build, 'error');
      expect(statusCallbackNock.isDone()).to.be.true;
    });
  });

  describe('reportBuildStatus @buildStatus <> error', () => {
    it("should send a request to the build's status callback", async () => {
      const buildStatus = 'testStatus';
      const statusURL = url.parse('https://www.example.gov/status');
      const statusCallbackNock = mockBuildStatusCallback(statusURL, buildStatus);

      const build = {
        containerEnvironment: {
          STATUS_CALLBACK: statusURL.href,
        },
      };

      await BuildStatusReporter.reportBuildStatus(build, buildStatus);
      expect(statusCallbackNock.isDone()).to.be.true;
    });
  });
});
