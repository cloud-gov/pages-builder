const appEnv = require('./env');
const AWS = require('./src/aws');
const BuildScheduler = require('./src/build-scheduler');
const Cluster = require('./src/cluster');
const createServer = require('./src/server');
const SQSClient = require('./src/sqs-client');

if (appEnv.isAPMConfigured) {
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
