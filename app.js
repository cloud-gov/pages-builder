const appEnv = require('./env');
const AWS = require('./src/aws');
const BuildScheduler = require('./src/build-scheduler');
const logger = require('./src/logger');
const createServer = require('./src/server');
const SQSClient = require('./src/sqs-client');
const QueueClient = require('./src/queue-client');
const BuilderPool = require('./src/cf-task-pool');

const {
  NEW_RELIC_APP_NAME,
  NEW_RELIC_LICENSE_KEY,
} = process.env;

// If settings present, start New Relic
if (NEW_RELIC_APP_NAME && NEW_RELIC_LICENSE_KEY) {
  require('newrelic'); // eslint-disable-line global-require
}

const builderPool = new BuilderPool(appEnv);
const buildSQSQueue = new SQSClient(new AWS.SQS(), appEnv.sqsUrl);
const buildBullQueue = new QueueClient(appEnv.queueName);
const server = createServer(builderPool, buildQueue);

const buildScheduler = new BuildScheduler(
  builderPool,
  buildSQSQueue,
  buildBullQueue,
  server
);

process.on('unhandledRejection', (err) => {
  logger.error(err);
  process.exit(1);
});

buildScheduler.start();
