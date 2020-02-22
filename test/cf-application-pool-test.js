const { expect } = require('chai');
const nock = require('nock');
const url = require('url');

const CFApplicationPool = require('../src/cf-application-pool');

const mockBuildLogCallback = require('./nocks/build-log-callback-nock');
const mockBuildStatusCallback = require('./nocks/build-status-callback-nock');
const mockListAppsRequest = require('./nocks/cloud-foundry-list-apps-nock');
const mockListAppStatsRequest = require('./nocks/cloud-foundry-list-app-stats-nock');
const mockRestageAppRequest = require('./nocks/cloud-foundry-restage-app-nock');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const mockUpdateAppRequest = require('./nocks/cloud-foundry-update-app-nock');

function startPool(timeoutSecs = 21 * 60) {
  const builderPool = new CFApplicationPool(timeoutSecs * 1000);
  builderPool.start();
  return builderPool;
}

function mockContainers(num) {
  mockListAppsRequest(Array(num).fill({}));

  for (let i = 0; i < num; i += 1) {
    mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });
  }
}

describe('CFApplicationPool', () => {
  const logCallbackURL = url.parse('https://www.example.gov/log');
  const statusCallbackURL = url.parse('https://www.example.gov/status');
  let logCallbackNock;
  let statusCallbackNock;

  beforeEach(() => {
    logCallbackNock = mockBuildLogCallback(logCallbackURL);
    statusCallbackNock = mockBuildStatusCallback(statusCallbackURL);
  });

  afterEach(() => {
    process.env.BUILD_TIMEOUT_SECONDS = undefined;
    nock.cleanAll();
  });

  describe('._countAvailableContainers()', () => {
    it('should return the number of available containers', (done) => {
      const numContainers = 10;

      mockTokenRequest();
      mockContainers(numContainers);

      const builderPool = startPool();

      setTimeout(() => {
        expect(builderPool._countAvailableContainers()).to.eq(numContainers);
        done();
      }, 50);
    });
  });

  describe('.startBuild(build)', () => {
    it('should update and restage a container', (done) => {
      mockTokenRequest();
      mockListAppsRequest([{}]);

      const mockedUpdateRequest = mockUpdateAppRequest();
      const mockedRestageRequest = mockRestageAppRequest();

      const builderPool = startPool();

      setTimeout(() => {
        builderPool.startBuild({
          buildID: '123abc',
          containerEnvironment: {},
        });
        setTimeout(() => {
          expect(mockedUpdateRequest.isDone()).to.eq(true);
          expect(mockedRestageRequest.isDone()).to.eq(true);
          done();
        }, 50);
      }, 50);
    });

    it('should reduce the number of available containers by 1', (done) => {
      mockTokenRequest();
      mockListAppsRequest([{}]);
      mockUpdateAppRequest();
      mockRestageAppRequest();

      const builderPool = startPool();

      setTimeout(() => {
        expect(builderPool._countAvailableContainers()).to.eq(1);
        builderPool.startBuild({
          buildID: '123abc',
          containerEnvironment: {},
        });
        setTimeout(() => {
          expect(builderPool._countAvailableContainers()).to.eq(0);
          done();
        }, 50);
      }, 50);
    });

    it('should not reduce the number of containers by 1 if it fails to start the build', (done) => {
      mockTokenRequest();
      mockListAppsRequest([{ guid: 'fake-container' }]);
      mockUpdateAppRequest();

      nock('https://api.example.com').post(
        '/v2/apps/fake-container/restage'
      ).reply(500);

      const builderPool = startPool();

      setTimeout(() => {
        expect(builderPool._countAvailableContainers()).to.eq(1);
        builderPool.startBuild({
          buildID: '123abc',
          containerEnvironment: {},
        }).catch(() => {
          // This promise rejects, but we're not testing this right now
          // Adding the catch to make sure all promise rejections are handled
        });
        setTimeout(() => {
          expect(builderPool._countAvailableContainers()).to.eq(1);
          done();
        }, 50);
      }, 50);
    });

    it('should stop the build after the timeout has been exceeded', (done) => {
      mockTokenRequest();
      mockListAppsRequest([{ guid: '123abc' }]);
      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });
      mockUpdateAppRequest();
      mockRestageAppRequest();

      const builderPool = startPool(-1);

      builderPool.stopBuild = (buildID) => {
        expect(buildID).to.equal('123abc');
        done();
      };
      builderPool.start();

      setTimeout(() => {
        builderPool.startBuild({
          buildID: '123abc',
          containerEnvironment: {
            LOG_CALLBACK: logCallbackURL.href,
            STATUS_CALLBACK: statusCallbackURL.href,
          },
        });
      }, 50);
    });

    it("should send a request to the build's log and status callback when the build timesout", (done) => {
      mockTokenRequest();
      mockListAppsRequest([{}]);
      mockUpdateAppRequest();
      mockRestageAppRequest();

      const builderPool = startPool(-1);

      setTimeout(() => {
        builderPool.startBuild({
          buildID: '123abc',
          containerEnvironment: {
            LOG_CALLBACK: logCallbackURL.href,
            STATUS_CALLBACK: statusCallbackURL.href,
          },
        });
        setTimeout(() => {
          expect(logCallbackNock.isDone()).to.be.true;
          expect(statusCallbackNock.isDone()).to.be.true;
          done();
        }, 200);
      }, 50);
    });
  });

  describe('.stopBuild(buildID)', () => {
    it('should make the build for the given buildID available', () => {
      const builderPool = new CFApplicationPool();

      builderPool._containers = [
        {
          guid: '123abc',
          build: {
            buildID: '456def',
            containerEnvironment: {
              LOG_CALLBACK: logCallbackURL.href,
              STATUS_CALLBACK: statusCallbackURL.href,
            },
          },
        },
        {
          guid: '789ghi',
          build: undefined,
        },
      ];

      builderPool.stopBuild('456def');

      const container = builderPool._containers.find(c => c.guid === '123abc');

      expect(container).to.be.a('object');
      expect(container.build).to.be.undefined;
    });

    it("should not send a request to the build's log and status callback", (done) => {
      const builderPool = new CFApplicationPool();

      builderPool._containers = [
        {
          guid: '123abc',
          build: {
            buildID: '456def',
            containerEnvironment: {
              LOG_CALLBACK: logCallbackURL.href,
              STATUS_CALLBACK: statusCallbackURL.href,
            },
          },
        },
      ];

      builderPool.stopBuild('456def');

      setTimeout(() => {
        expect(logCallbackNock.isDone()).to.be.false;
        expect(statusCallbackNock.isDone()).to.be.false;
        done();
      }, 200);
    });
  });

  describe.only('.canStartBuild()', () => {
    it('returns true if there are available containers', async () => {
      mockTokenRequest();
      mockContainers(1);

      const builderPool = new CFApplicationPool(1000);
      await builderPool.start();

      expect(await builderPool.canStartBuild()).to.be.true;
    });

    it('returns false if there are no available containers', async () => {
      mockTokenRequest();
      mockContainers(0);

      const builderPool = new CFApplicationPool(1000);
      await builderPool.start();

      expect(await builderPool.canStartBuild()).to.be.false;
    });
  });
});
