const appEnv = require('./env');
const AWS = require('./src/aws');
const BuildScheduler = require('./src/build-scheduler');
const logger = require('./src/logger');
const createServer = require('./src/server');
const SQSClient = require('./src/sqs-client');

const {
  NEW_RELIC_APP_NAME,
  NEW_RELIC_LICENSE_KEY,
  BUILD_TIMEOUT_SECONDS,
  BUILDER_POOL_TYPE,
  TASK_POOL_APP_NAME,
  TASK_POOL_APP_COMMAND,
} = process.env;

// If settings present, start New Relic
if (NEW_RELIC_APP_NAME && NEW_RELIC_LICENSE_KEY) {
  require('newrelic'); // eslint-disable-line global-require
}

const buildTimeout = 1000 * (parseInt(BUILD_TIMEOUT_SECONDS, 10) || 21 * 60); // milliseconds

// eslint-disable-next-line no-use-before-define
const BuilderPool = getBuilderPool(BUILDER_POOL_TYPE);
const builderPool = new BuilderPool({
  buildTimeout,
  taskAppName: TASK_POOL_APP_NAME,
  taskAppCommand: TASK_POOL_APP_COMMAND,
});
const buildQueue = new SQSClient(new AWS.SQS(), appEnv.sqsUrl);
const server = createServer(builderPool, buildQueue);

const buildScheduler = new BuildScheduler(
  builderPool,
  buildQueue,
  server
);

process.on('unhandledRejection', (err) => {
  logger.error(err);
  process.exit(1);
});

buildScheduler.start();

function getBuilderPool(type) {
  /* eslint-disable global-require */
  return type === 'task'
    ? require('./src/cf-task-pool')
    : require('./src/cf-application-pool');
  /* eslint-enable global-require */
}
