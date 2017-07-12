// Setup winston for logging
const winston = require('winston');

winston.level = process.env.LOG_LEVEL || 'info';

// If settings present, start New Relic
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) {
  winston.info('Activating New Relic: ', process.env.NEW_RELIC_APP_NAME);
  require('newrelic'); // eslint-disable-line global-require
}

// Start a BuildScheduler
const BuildScheduler = require('./src/build-scheduler');

const buildScheduler = new BuildScheduler();
buildScheduler.start();
