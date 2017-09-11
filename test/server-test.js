const expect = require('chai').expect;

const server = require('../src/server');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');

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
      const testServer = server(mockCluster());
      mockTokenRequest();

      testServer.inject({
        method: 'GET',
        url: '/healthcheck',
      }, (response) => {
        expect(response.statusCode).to.eq(200);
        expect(response.result).to.deep.equal({ ok: true });
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
        expect(response.result).to.deep.equal({ ok: false });
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
