const logger = require('../logger');
const CloudFoundryAuthClient = require('../cloud-foundry-auth-client');
const CloudFoundryApiClient = require('../cloud-foundry-api-client');

const ATTR_NUM_MESSAGES = 'ApproximateNumberOfMessages';
const ATTR_NUM_MESSAGES_DELAYED = 'ApproximateNumberOfMessagesDelayed';

function replyOk(buildContainers, queueSQSAttributes, queueBullAttributes) {
  return {
    ok: true,
    buildContainers,
    queueSQSAttributes,
    queueBullAttributes,
  };
}

function replyNotOk(reasons) {
  return { ok: false, reasons };
}

function checkForErrors(token, queueSQSAttributes, queueBullAttributes, buildContainersState) {
  const errorReasons = [];
  if (!token) {
    errorReasons.push('No cloud foundry token received.');
  }

  if (queueSQSAttributes.error) {
    errorReasons.push(queueSQSAttributes.error);
  }

  if (queueBullAttributes.error) {
    errorReasons.push(queueBullAttributes.error);
  }

  if (buildContainersState.error) {
    errorReasons.push(buildContainersState.error);
  }
  return errorReasons;
}

// Route handler for builder healthcheck
function createHealthcheckHandler(buildSQSClient, buildBullClient) {
  return function healthcheckHandler(request, h) {
    const authClient = new CloudFoundryAuthClient();
    const apiClient = new CloudFoundryApiClient();

    // Array of promises returned from methods we want included in the healthcheck
    const checkPromises = [
      authClient.accessToken(), // make sure we can authenticate with cloud.gov
      buildSQSClient.getQueueAttributes([ATTR_NUM_MESSAGES, ATTR_NUM_MESSAGES_DELAYED]),
      buildBullClient.getQueueAttributes(),
      apiClient.getBuildContainersState(),
    ];

    let reply;
    return Promise.all(checkPromises)
      .then(([token, queueSQSAttributes, queueBullAttributes, buildContainersState]) => {
        const errorReasons = checkForErrors(
          token, queueSQSAttributes, queueBullAttributes, buildContainersState
        );
        if (errorReasons.length) {
          reply = replyNotOk(errorReasons);
        } else {
          reply = replyOk(buildContainersState, queueSQSAttributes, queueBullAttributes);
        }
      })
      .catch((err) => {
        logger.error('Healthcheck error:', err);
        reply = replyNotOk([err.message]);
      })
      .then(() => h.response(reply));
  };
}

module.exports = createHealthcheckHandler;
