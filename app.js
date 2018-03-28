const cfenv = require('cfenv');
const winston = require('winston');

// Setup winston for logging
winston.level = process.env.LOG_LEVEL || 'info';

// If settings present, start New Relic
if (process.env.NEW_RELIC_APP_NAME) {
  const creds = cfenv.getAppEnv().getServiceCreds('federalist-builder-env');
  if (creds.NEW_RELIC_LICENSE_KEY) {
    winston.info(`Activating New Relic: ${process.env.NEW_RELIC_APP_NAME}`);
    require('newrelic'); // eslint-disable-line global-require
  }
}

const sqsCredentials = cfenv.getAppEnv().getServiceCreds('federalist-staging-sqs-creds');
process.env.SQS_URL = sqsCredentials.sqs_url;

const BuildScheduler = require('./src/build-scheduler');

// Start a BuildScheduler
const buildScheduler = new BuildScheduler();
buildScheduler.start();
