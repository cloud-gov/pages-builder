const cfenv = require('cfenv');
const AWS = require('./src/aws');
const BuildScheduler = require('./src/build-scheduler');
const Cluster = require('./src/cluster');
const logger = require('./src/logger');
const createServer = require('./src/server');
const SQSClient = require('./src/sqs-client');

const appEnv = cfenv.getAppEnv();

const { APP_ENV, NEW_RELIC_APP_NAME } = process.env;

// If settings present, start New Relic
if (NEW_RELIC_APP_NAME) {
  const creds = appEnv.getServiceCreds('federalist-builder-env');
  if (creds.NEW_RELIC_LICENSE_KEY) {
    logger.info(`Activating New Relic: ${NEW_RELIC_APP_NAME}`);
    require('newrelic'); // eslint-disable-line global-require
  }
}

const queueURL = appEnv.getServiceCreds(`federalist-${APP_ENV}-sqs-creds`).sqs_url;

const builderPool = new Cluster();
const buildQueue = new SQSClient(new AWS.SQS(), queueURL);
const server = createServer(builderPool, buildQueue);

const buildScheduler = new BuildScheduler(
  builderPool,
  buildQueue,
  server
);
buildScheduler.start();
