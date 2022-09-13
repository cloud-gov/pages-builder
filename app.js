const appEnv = require('./env');
const bullQueue = require('./src/bull-queue');
const BuildScheduler = require('./src/build-scheduler');
const logger = require('./src/logger');
const createServer = require('./src/server');
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

const queues = [];

logger.info('Listening on Bull Queue');
queues.push(new QueueClient(bullQueue(appEnv.queueName)));

if (queues.length === 0) {
  logger.error('No queues specified, exiting');
  process.exit(1);
}

const builderPool = new BuilderPool(appEnv);

const server = createServer(builderPool, queues);

const buildScheduler = new BuildScheduler(builderPool, queues, server);

process.on('unhandledRejection', (err) => {
  logger.error(err);
  process.exit(1);
});

buildScheduler.start();
