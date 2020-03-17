const appEnv = require('./env');
const AWS = require('./src/aws');
const BuildScheduler = require('./src/build-scheduler');
const Cluster = require('./src/cluster');
const createServer = require('./src/server');
const SQSClient = require('./src/sqs-client');

const { NEW_RELIC_APP_NAME, NEW_RELIC_LICENSE_KEY } = process.env;

// If settings present, start New Relic
if (NEW_RELIC_APP_NAME && NEW_RELIC_LICENSE_KEY) {
  require('newrelic'); // eslint-disable-line global-require
}

const builderPool = new Cluster();
const buildQueue = new SQSClient(new AWS.SQS(), appEnv.sqsUrl);
const server = createServer(builderPool, buildQueue);

const buildScheduler = new BuildScheduler(
  builderPool,
  buildQueue,
  server
);
buildScheduler.start();
