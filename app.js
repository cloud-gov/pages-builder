const cfenv = require('cfenv');
const AWS = require('./src/aws');
const BuildScheduler = require('./src/build-scheduler');
const Cluster = require('./src/cluster');
const createServer = require('./src/server');
const SQSClient = require('./src/sqs-client');

const appEnv = cfenv.getAppEnv();

const { APP_ENV } = process.env;

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
