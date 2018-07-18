const expect = require('chai').expect;
const nock = require('nock');

const server = require('../src/server');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const mockListAppsRequest = require('./nocks/cloud-foundry-list-apps-nock');
const mockListAppStatsRequest = require('./nocks/cloud-foundry-list-app-stats-nock');
const awsMock = require('./aws-mock');


const mockCluster = () => ({ stopBuild: () => {} });

describe('server', () => {
  afterEach(() => nock.cleanAll());

  describe('GET /', () => {
    it('should respond with a 200', (done) => {
      const testServer = server(mockCluster());

      testServer.inject({
        method: 'GET',
        url: '/',
      }, (response) => {
        expect(response.statusCode).to.eq(200);
        done();
      });
    });
  });

  describe('GET /healthcheck', () => {
    const mockGoodListAppsRequest = () => {
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'builder-1',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
        {
          guid: '456def',
          name: 'builder-2',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
      ]);
      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });
      mockListAppStatsRequest('456def', { 0: { state: 'RUNNING' } });
    };

    it('should be ok all is good', (done) => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);
      process.env.SERVICE_KEY_CREATED = new Date(new Date() - (1 * 24 * 60 * 60 * 1000));

      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockGoodListAppsRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: true,
          buildContainers: {
            expected: 2,
            found: 2,
            started: 2,
          },
          queueAttributes: queueAttributes.Attributes,
          deployerCredentials: {
            containerDeployer: {created_at: new Date(process.env.SERVICE_KEY_CREATED).toLocaleDateString(), expire_in_days: 88},
            circleDeployer: { created_at: new Date(process.env.SERVICE_KEY_CREATED).toLocaleDateString(), expire_in_days: 88},
          }
        };

        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should not be ok when an access token cannot be retrieved', (done) => {
      const testServer = server(mockCluster());
      mockTokenRequest('badtoken');
      mockTokenRequest(); // nock another request for fetching build containers
      mockGoodListAppsRequest();

      const expectedResult = {
        ok: false,
        reasons: ['Received status code: 401'],
      };

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expectedResult);
        done();
      });
    });

    it('should not be ok when an access token is non-existent', (done) => {
      const testServer = server(mockCluster());
      mockTokenRequest('emptytoken');
      mockTokenRequest(); // nock another request for fetching build containers
      mockGoodListAppsRequest();

      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);

      const expectedResult = {
        ok: false,
        reasons: ['No cloud foundry token received.'],
      };

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expectedResult);
        restoreAWS();
        done();
      });
    });

    it('should not be ok if SQS attributes cannot be retrieved', (done) => {
      const error = { error: 'Queue attributes unavailable.' };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', null, error);
      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockGoodListAppsRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reasons: [error.error],
        };

        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should not be ok if there are not enough build containers', (done) => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);

      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockListAppsRequest([{ name: 'builder-1' }]);

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reasons: [
            [
              'Expected 2 build containers but only 1 found.',
              'Not all build containers are in the STARTED state.',
            ].join('\n'),
          ],
        };

        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should not be ok if any container is not STARTED', (done) => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);

      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockListAppsRequest([
        {
          state: 'SOME_OTHER_STATE',
        },
        {
          guid: '123abc',
          state: 'STARTED',
        },
      ]);
      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });
      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reasons: [
            'Not all build containers are in the STARTED state.',
          ],
        };

        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should be able to report multiple error reasons', (done) => {
      const error = { error: 'Queue attributes unavailable.' };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', null, error);
      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockListAppsRequest([{ guid: '123abc', name: 'builder-1' }]);
      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reasons: [
            error.error,
            [
              'Expected 2 build containers but only 1 found.',
              'Not all build containers are in the STARTED state.',
            ].join('\n'),
          ],
        };

        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should false expired credentials', (done) => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);
      process.env.SERVICE_KEY_CREATED = new Date(new Date() - (90 * 24 * 60 * 60 * 1000));

      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockGoodListAppsRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reasons: [
            "containerDeployer: credentials are expired!!!",
            "circleDeployer: credentials are expired!!!"
          ]
        };

        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should false expired credentials in < 7 days', (done) => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);
      process.env.SERVICE_KEY_CREATED = new Date(new Date() - (85 * 24 * 60 * 60 * 1000));

      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockGoodListAppsRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reasons: [
              "containerDeployer: expires in less than 7 days!!!",
              "circleDeployer: expires in less than 7 days!!!"
          ]
        };
        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should false credentials created in future', (done) => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);
      process.env.SERVICE_KEY_CREATED = '3000-01-01';

      const testServer = server(mockCluster());

      mockTokenRequest().persist();
      mockGoodListAppsRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reasons: [
            "containerDeployer: credentials require attention!!!",
            "circleDeployer: credentials require attention!!!"
          ]
        };
        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });
  });

  describe('DELETE /builds/{buildID}/callback', () => {
    it('should respond with a 200', (done) => {
      const testServer = server(mockCluster());

      testServer.inject({
        method: 'DELETE',
        url: '/builds/123abc/callback',
      }, (response) => {
        expect(response.statusCode).to.eq(200);
        done();
      });
    });

    it('should call stopBuild(buildID) on the cluster', (done) => {
      let stopBuildArg;
      const cluster = {
        stopBuild: (buildID) => {
          stopBuildArg = buildID;
        },
      };

      const testServer = server(cluster);

      testServer.inject({
        method: 'DELETE',
        url: '/builds/123abc/callback',
      }, () => {
        expect(stopBuildArg).to.eq('123abc');
        done();
      });
    });
  });
});
