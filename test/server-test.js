const { expect } = require('chai');
const nock = require('nock');

const server = require('../src/server');
const SQSClient = require('../src/sqs-client');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const mockListAppsRequest = require('./nocks/cloud-foundry-list-apps-by-label-nock');
const mockListAppStatsRequest = require('./nocks/cloud-foundry-list-app-stats-nock');

const mockCluster = () => ({ });
const mockBuildQueue = (sqs = {}) => new SQSClient(sqs, 'QUEUE_URL');

describe('server', () => {
  afterEach(() => {
    nock.abortPendingRequests();
    nock.cleanAll();
  });

  describe('GET /', () => {
    it('should respond with a 200', (done) => {
      const testServer = server(mockCluster(), mockBuildQueue());

      testServer.inject({
        method: 'GET',
        url: '/',
      })
        .then((response) => {
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
          name: 'test-builder-1',
          state: 'STARTED',
        },
        {
          guid: '456def',
          name: 'test-builder-2',
          state: 'STARTED',
        },
      ]);
      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });
      mockListAppStatsRequest('456def', { 0: { state: 'RUNNING' } });
    };

    it('should be ok all is good', () => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };

      const testServer = server(mockCluster(), mockBuildQueue({
        getQueueAttributes: (_, cb) => cb(null, queueAttributes),
      }));

      mockTokenRequest().persist();
      mockGoodListAppsRequest();

      return testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      })
        .then((response) => {
          const expected = {
            ok: true,
            buildContainers: {
              found: 2,
              started: 2,
            },
            queueAttributes: queueAttributes.Attributes,
          };

          expect(response.statusCode).to.eq(200);
          expect(response.result).to.deep.equal(expected);
        });
    });

    it('should not be ok when an access token cannot be retrieved', () => {
      const testServer = server(mockCluster(), mockBuildQueue({
        getQueueAttributes: (_, cb) => cb(null, {}),
      }));
      mockTokenRequest('badtoken');
      mockTokenRequest(); // nock another request for fetching build containers
      mockGoodListAppsRequest();

      const expectedResult = {
        ok: false,
        reasons: ['Request failed with status code 401'],
      };

      return testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      })
        .then((response) => {
          expect(response.statusCode).to.eq(200);
          expect(response.result).to.deep.equal(expectedResult);
        });
    });

    it('should not be ok when an access token is non-existent', () => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };
      const testServer = server(mockCluster(), mockBuildQueue({
        getQueueAttributes: (_, cb) => cb(null, queueAttributes),
      }));
      mockTokenRequest('emptytoken');
      mockTokenRequest(); // nock another request for fetching build containers
      mockGoodListAppsRequest();

      const expectedResult = {
        ok: false,
        reasons: ['No cloud foundry token received.'],
      };

      return testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      })
        .then((response) => {
          expect(response.statusCode).to.eq(200);
          expect(response.result).to.deep.equal(expectedResult);
        });
    });

    it('should not be ok if SQS attributes cannot be retrieved', () => {
      const error = { error: 'Queue attributes unavailable.' };
      const testServer = server(mockCluster(), mockBuildQueue({
        getQueueAttributes: (_, cb) => cb(error),
      }));

      mockTokenRequest().persist();
      mockGoodListAppsRequest();

      return testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      })
        .then((response) => {
          const expected = {
            ok: false,
            reasons: [error.error],
          };

          expect(response.statusCode).to.eq(200);
          expect(response.result).to.deep.equal(expected);
        });
    });

    it('should not be ok if there are not enough build containers', () => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };

      const testServer = server(mockCluster(), mockBuildQueue({
        getQueueAttributes: (_, cb) => cb(null, queueAttributes),
      }));

      mockTokenRequest().persist();
      mockListAppsRequest([{ name: 'test-builder-1' }]);

      return testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      })
        .then((response) => {
          const expected = {
            ok: false,
            reasons: [
              [
                'Not all build containers are in the STARTED state.',
              ].join('\n'),
            ],
          };

          expect(response.statusCode).to.eq(200);
          expect(response.result).to.deep.equal(expected);
        });
    });

    it('should not be ok if any container is not STARTED', () => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessages: 2 } };

      const testServer = server(mockCluster(), mockBuildQueue({
        getQueueAttributes: (_, cb) => cb(null, queueAttributes),
      }));

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

      return testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      })
        .then((response) => {
          const expected = {
            ok: false,
            reasons: [
              'Not all build containers are in the STARTED state.',
            ],
          };

          expect(response.statusCode).to.eq(200);
          expect(response.result).to.deep.equal(expected);
        });
    });

    it('should be able to report multiple error reasons', () => {
      const error = { error: 'Queue attributes unavailable.' };
      const testServer = server(mockCluster(), mockBuildQueue({
        getQueueAttributes: (_, cb) => cb(error),
      }));

      mockTokenRequest().persist();
      mockListAppsRequest([{ guid: '123abc', name: 'test-builder-1' }]);
      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });

      return testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      })
        .then((response) => {
          const expected = {
            ok: false,
            reasons: [
              error.error,
              [
                'Not all build containers are in the STARTED state.',
              ].join('\n'),
            ],
          };

          expect(response.statusCode).to.eq(200);
          expect(response.result).to.deep.equal(expected);
        });
    });
  });
});
