const Hapi = require('hapi');
const winston = require('winston');

const healthcheckHandler = require('./healthcheck');

function createServer(cluster) {
  const server = new Hapi.Server({ port: process.env.PORT || 8080 });

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      const response = h.response('Server running');
      response.type('text/plain');
      response.code(200);

      winston.info('GET %s - 200', request.url.path);
      return response;
    },
  });

  server.route({
    // Exposes an endpoint to report builder health
    method: 'GET',
    path: '/healthcheck',
    handler: healthcheckHandler,
  });

  server.route({
    method: 'DELETE',
    path: '/builds/{buildID}/callback',
    handler: (request, h) => {
      try {
        cluster.stopBuild(request.params.buildID);
      } catch (error) {
        winston.error(`Error stopping build${request}`, error);
      }

      const response = h.response('Callback registered');
      response.type('text/plain');
      response.code(200);

      winston.info('GET %s - 200', request.url.path);
      return response;
    },
  });

  return server;
}

module.exports = createServer;
