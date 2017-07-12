const expect = require('chai').expect;
const server = require('../src/server');

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
