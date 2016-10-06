// If settings present, start New Relic
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) {
  console.log('Activating New Relic: ', process.env.NEW_RELIC_APP_NAME);
  require('newrelic');
}

// Start the health check server
var http = require('http')
http.createServer(function(req, res) {
  log('Federalist-Builder started');

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
}).listen(process.env.PORT || 8000);

// Start a BuildScheduler
const BuildScheduler = require("./src/build-scheduler")
const buildScheduler = new BuildScheduler()
buildScheduler.start()
