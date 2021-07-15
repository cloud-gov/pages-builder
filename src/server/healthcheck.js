const logger = require('../logger');
const CloudFoundryAuthClient = require('../cloud-foundry-auth-client');
const CloudFoundryApiClient = require('../cloud-foundry-api-client');

function replyOk(buildContainers, ...queueAttributes) {
  return {
    ok: true,
    buildContainers,
    queueAttributes,
  };
}

function replyNotOk(reasons) {
  return { ok: false, reasons };
}

function checkForErrors(token, buildContainersState, ...queueAttributes) {
  const errorReasons = [];
  if (!token) {
    errorReasons.push('No cloud foundry token received.');
  }

  if (buildContainersState.error) {
    errorReasons.push(buildContainersState.error);
  }

  queueAttributes
    .filter(queueAttribute => queueAttribute.error)
    .forEach(queueAttribute => errorReasons.push(queueAttribute.error));

  return errorReasons;
}

// Route handler for builder healthcheck
function createHealthcheckHandler(queues) {
  return function healthcheckHandler(request, h) {
    const authClient = new CloudFoundryAuthClient();
    const apiClient = new CloudFoundryApiClient();

    // Array of promises returned from methods we want included in the healthcheck
    const checkPromises = [
      authClient.accessToken(), // make sure we can authenticate with cloud.gov
      apiClient.getBuildContainersState(),
      ...queues.map(queue => queue.getQueueAttributes()),
    ];

    let reply;
    return Promise.all(checkPromises)
      .then(([token, buildContainersState, ...queueAttributes]) => {
        const errorReasons = checkForErrors(token, buildContainersState, ...queueAttributes);
        if (errorReasons.length) {
          reply = replyNotOk(errorReasons);
        } else {
          reply = replyOk(buildContainersState, ...queueAttributes);
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
