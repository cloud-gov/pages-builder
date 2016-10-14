// If settings present, start New Relic
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) {
  console.log('Activating New Relic: ', process.env.NEW_RELIC_APP_NAME);
  require('newrelic');
}

// Start a BuildScheduler
const BuildScheduler = require("./src/build-scheduler")
const buildScheduler = new BuildScheduler()
buildScheduler.start()
