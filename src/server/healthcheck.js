const winston = require('winston');

const CloudFoundryAuthClient = require('../cloud-foundry-auth-client');
const SQSClient = require('../sqs-client');
const CloudFoundryApiClient = require('../cloud-foundry-api-client');

const ATTR_NUM_MESSAGES = 'ApproximateNumberOfMessages';
const ATTR_NUM_MESSAGES_DELAYED = 'ApproximateNumberOfMessagesDelayed';

function healthcheckHandler(request, reply) {
  // Route handler for builder healthcheck
  const authClient = new CloudFoundryAuthClient();
  const queueClient = new SQSClient();
  const apiClient = new CloudFoundryApiClient();

  // Helpers to create response object
  const replyOk = (buildContainers, queueAttributes) => reply(
    Object.assign({}, { ok: true }, { buildContainers, queueAttributes })
  );

  const replyNotOk = reasons => reply({ ok: false, reasons });

  // Array of promises returned from methods we want included in the healthcheck
  const checkPromises = [
    authClient.accessToken(), // make sure we can authenticate with cloud.gov
    queueClient.getQueueAttributes([ATTR_NUM_MESSAGES, ATTR_NUM_MESSAGES_DELAYED]),
    apiClient.getBuildContainersState(),
  ];

  Promise.all(checkPromises)
    .then(([token, queueAttributes, buildContainersState]) => {
      const errorReasons = [];
      if (!token) {
        errorReasons.push('No cloud foundry token received.');
      }

      if (queueAttributes.error) {
        errorReasons.push(queueAttributes.error);
      }

      if (buildContainersState.error) {
        errorReasons.push(buildContainersState.error);
      }

      if (errorReasons.length) {
        replyNotOk(errorReasons);
      } else {
        replyOk(buildContainersState, queueAttributes);
      }
    })
    .catch((err) => {
      winston.error('Healthcheck error', err);
      replyNotOk([err.message]);
    });
}

module.exports = healthcheckHandler;
