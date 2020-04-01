const Hapi = require('@hapi/hapi');
const logger = require('../logger');

const createHealthcheckHandler = require('./healthcheck');

function createServer(builderPool, buildQueue) {
  const server = new Hapi.Server({ port: process.env.PORT || 8080 });

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      const response = h.response('Server running');
      response.type('text/plain');
      response.code(200);

      logger.info('GET %s - 200', request.url.path);
      return response;
    },
  });

  server.route({
    // Exposes an endpoint to report builder health
    method: 'GET',
    path: '/healthcheck',
    handler: createHealthcheckHandler(buildQueue),
  });

  server.route({
    method: 'DELETE',
    path: '/builds/{buildID}/callback',
    handler: (request, h) => {
      try {
        builderPool.stopBuild(request.params.buildID);
      } catch (error) {
        logger.error(`Error stopping build${request}`, error);
      }

      const response = h.response('Callback registered');
      response.type('text/plain');
      response.code(200);

      logger.info('GET %s - 200', request.url.path);
      return response;
    },
  });

  return server;
}

module.exports = createServer;
