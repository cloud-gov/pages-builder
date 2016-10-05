// If settings present, start New Relic
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) {
  console.log('Activating New Relic: ', process.env.NEW_RELIC_APP_NAME);
  require('newrelic');
}

// ENV Vars
const maxTasks = process.env.MAX_TASKS
const port = process.env.PORT

// Librarys
var http = require('http')

// Setup cluster manager
const Cluster = require("./src/cluster")
const cluster = new Cluster()

// Setup SQS client
const SQSClient = require("./src/sqs-client")
const sqsClient = new SQSClient()

// Listen on PORT (CloudFoundry pings this to make sure the script is running)
http.createServer(function(req, res) {
  log('Federalist-Builder started');

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
}).listen(port || 8000);

// Start watching the queue
checkQueue();

// Check SQS queue
function checkQueue() {
  sqsClient.receiveMessage().then(message => {
    if (message) {
      checkCapacity(message)
    }
    checkQueue()
  }).catch(err => {
    error(err)
    checkQueue()
  })
}

// On message, check ECS task capacity and length
function checkCapacity(message) {
  cluster.countAvailableNodes().then(nodeCount => {
    if (nodeCount < maxTasks) {
      runTask(message)
    }
  }).catch(err => error(err))
}

// Run task and delete message once it's initialized
function runTask(message) {
  const containerOverrides = JSON.parse(message.Body)

  cluster.runTask(containerOverrides).then(() => {
    return sqsClient.deleteMessage(message)
  }).catch(err => error(err))
}

// Handle errors
function error(err) {
  console.error(new Error(err));
}

function log(/** message, ...arguments**/) {
  if (debugMode) {
    console.log.apply(this, arguments);
  }
}
