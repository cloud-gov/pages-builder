const Hapi = require('hapi');
const winston = require('winston');
const CloudFoundryAuthClient = require('./cloud-foundry-auth-client');

function createServer(cluster) {
  const server = new Hapi.Server();

  server.connection({ port: process.env.PORT || 8080 });

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, reply) => {
      const response = reply('Server running');
      response.type('text/plain');
      response.statusCode = 200;

      winston.info('GET %s - 200', request.url.path);
    },
  });

  server.route({
    method: 'GET',
    path: '/healthcheck',
    handler: (request, reply) => {
      // Exposes an endpoint to report on server health

      const authClient = new CloudFoundryAuthClient();

      // Array of promises returned from methods we want included in the healthcheck
      const checkPromises = [
        authClient.accessToken(), // make sure we can authenticate with cloud.gov
      ];

      const replyOk = () => reply({ ok: true });
      const replyNotOk = () => reply({ ok: false });

      Promise.all(checkPromises)
        .then(([token]) => {
          if (!token) {
            replyNotOk();
          } else {
            replyOk();
          }
        })
        .catch((err) => {
          winston.error('Healthcheck error', err);
          replyNotOk();
        });
    },
  });

  server.route({
    method: 'DELETE',
    path: '/builds/{buildID}/callback',
    handler: (request, reply) => {
      try {
        cluster.stopBuild(request.params.buildID);
      } catch (error) {
        winston.error(`Error stopping build${request}`, error);
      }

      const response = reply('Callback registered');
      response.type('text/plain');
      response.statusCode = 200;

      winston.info('GET %s - 200', request.url.path);
    },
  });

  return server;
}

module.exports = createServer;
