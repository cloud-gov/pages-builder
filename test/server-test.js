const expect = require('chai').expect;
const server = require('../src/server');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const awsMock = require('./aws-mock');


const mockCluster = () => ({ stopBuild: () => {} });

describe('server', () => {
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
    it('should be ok when a valid access token can be retrieved', (done) => {
      const queueAttributes = { Attributes: { ApproximateNumberOfMessage: 2 } };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', queueAttributes);

      const testServer = server(mockCluster());

      mockTokenRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = Object.assign({}, { ok: true }, queueAttributes.Attributes);

        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal(expected);
        restoreAWS();
        done();
      });
    });

    it('should not be ok when an access token cannot be retrieved', (done) => {
      const testServer = server(mockCluster());
      mockTokenRequest('badtoken');

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        expect(response.statusCode).to.eq(200);
        expect(Object.keys(response.result)).to.deep.equal(['ok', 'reason']);
        done();
      });
    });

    it('should not be ok if SQS attributes cannot be retrieved', (done) => {
      const error = { error: 'queue attributes unavailable' };
      const restoreAWS = awsMock.mock('SQS', 'getQueueAttributes', null, error);
      const testServer = server(mockCluster());

      mockTokenRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        const expected = {
          ok: false,
          reason: error.error,
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
