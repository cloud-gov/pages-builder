const winston = require('winston');

const CloudFoundryAuthClient = require('../cloud-foundry-auth-client');
const SQSClient = require('../sqs-client');
const CloudFoundryApiClient = require('../cloud-foundry-api-client');

const ATTR_NUM_MESSAGES = 'ApproximateNumberOfMessages';
const ATTR_NUM_MESSAGES_DELAYED = 'ApproximateNumberOfMessagesDelayed';


function replyOk(reply, buildContainers, queueAttributes, deployerStatuses) {
  reply({
    ok: true,
    buildContainers,
    queueAttributes,
    deployerCredentials: deployerStatuses,
  });
}

function replyNotOk(reply, reasons) {
  reply({ ok: false, reasons });
}

function checkForErrors(token, queueAttributes, buildContainersState, deployerStatuses) {
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

  Object.keys(deployerStatuses).forEach((deployer) => {
    if (deployerStatuses[deployer].error) {
      errorReasons.push(deployerStatuses[deployer].error);
    } else if (deployerStatuses[deployer].expireInDays > 90) {
      errorReasons.push(`${deployer}: credentials require attention!!!`);
    } else if (deployerStatuses[deployer].expireInDays <= 0) {
      errorReasons.push(`${deployer}: credentials are expired!!!`);
    } else if (deployerStatuses[deployer].expireInDays <= 10) {
      errorReasons.push(`${deployer}: expires in ${deployerStatuses[deployer].expireInDays} days!!!`);
    }
  });

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
    apiClient.fetchDeployerStatuses(),
  ];

  Promise.all(checkPromises)
    .then(([token, queueAttributes, buildContainersState, deployers]) => {
      const errorReasons = checkForErrors(token, queueAttributes, buildContainersState, deployers);
      if (errorReasons.length) {
        replyNotOk(reply, errorReasons);
      } else {
        replyOk(reply, buildContainersState, queueAttributes, deployers);
      }
    })
    .catch((err) => {
      winston.error('Healthcheck error:', err);
      replyNotOk(reply, [err.message]);
    });
}

module.exports = healthcheckHandler;
