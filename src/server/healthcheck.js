const winston = require('winston');

const CloudFoundryAuthClient = require('../cloud-foundry-auth-client');
const SQSClient = require('../sqs-client');
const CloudFoundryApiClient = require('../cloud-foundry-api-client');

const ATTR_NUM_MESSAGES = 'ApproximateNumberOfMessages';
const ATTR_NUM_MESSAGES_DELAYED = 'ApproximateNumberOfMessagesDelayed';


function replyOk(reply, buildContainers, queueAttributes) {
  reply({
    ok: true,
    buildContainers,
    queueAttributes,
  });
}

function replyNotOk(reply, reasons) {
  reply({ ok: false, reasons });
}

function checkForErrors(token, queueAttributes, buildContainersState) {
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

  return errorReasons;
}


// Route handler for builder healthcheck
function healthcheckHandler(request, reply) {
  const authClient = new CloudFoundryAuthClient();
  const queueClient = new SQSClient();
  const apiClient = new CloudFoundryApiClient();

  // Array of promises returned from methods we want included in the healthcheck
  const checkPromises = [
    authClient.accessToken(), // make sure we can authenticate with cloud.gov
    queueClient.getQueueAttributes([ATTR_NUM_MESSAGES, ATTR_NUM_MESSAGES_DELAYED]),
    apiClient.getBuildContainersState(),
  ];

  Promise.all(checkPromises)
    .then(([token, queueAttributes, buildContainersState]) => {
      const errorReasons = checkForErrors(token, queueAttributes, buildContainersState);
      if (errorReasons.length) {
        replyNotOk(reply, errorReasons);
      } else {
        replyOk(reply, buildContainersState, queueAttributes);
      }
    })
    .catch((err) => {
      winston.error('Healthcheck error:', err);
      replyNotOk(reply, [err.message]);
    });
}

module.exports = healthcheckHandler;
