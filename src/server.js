const Hapi = require('hapi');
const winston = require('winston');
const CloudFoundryAuthClient = require('./cloud-foundry-auth-client');
const SQSClient = require('./sqs-client');

const NUM_MESSAGES = 'ApproximateNumberOfMessages';

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
      const queueClient = new SQSClient();

      // Array of promises returned from methods we want included in the healthcheck
      const checkPromises = [
        authClient.accessToken(), // make sure we can authenticate with cloud.gov
        queueClient.getQueueAttributes(NUM_MESSAGES),
      ];

      const replyOk = (attributes = {}) => reply(Object.assign({}, { ok: true }, attributes));
      const replyNotOk = (error = {}) => reply(Object.assign({}, { ok: false }, error));

      Promise.all(checkPromises)
        .then(([token, attributes]) => {
          let error;

          if (!token) {
            error = { reason: 'No cloud foundry token received' };
          } else if (attributes.error) {
            error = { reason: attributes.error };
          }

          if (error) {
            replyNotOk(error);
          } else {
            replyOk(attributes);
          }
        })
        .catch((err) => {
          winston.error('Healthcheck error', err);
          replyNotOk({ reason: err.message });
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
