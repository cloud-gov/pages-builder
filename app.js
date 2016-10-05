// If settings present, start New Relic
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) {
  console.log('Activating New Relic: ', process.env.NEW_RELIC_APP_NAME);
  require('newrelic');
}

// ENV Vars
var queueUrl = process.env.SQS_URL,
    maxTasks = process.env.MAX_TASKS,
    port = process.env.PORT,
    debugMode = process.env.DEBUG || false;

// Librarys
var http = require('http')

// AWS services
const AWS = require("./src/aws")
const sqs = new AWS.SQS()

// Setup cluster manager
const Cluster = require("./src/cluster")
const cluster = new Cluster()

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
  log('function checkQueue() called');

  var params = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20
      };
  sqs.receiveMessage(params, function(err, data) {
    log('SQS receiveMessage: ', err, data.Messages);

    if (err) error(err);

    if (data && data.Messages && data.Messages[0]) {
      checkCapacity(data.Messages[0]);
    }
    checkQueue();
  });
}

// On message, check ECS task capacity and length
function checkCapacity(message) {
  cluster.countAvailableNodes().then(nodeCount => {
    if (nodeCount < maxTasks) {
      runTask(message)
    }
  }).catch(err => {
    error(err)
  })
}

// Run task and delete message once it's initialized
function runTask(message) {
  const containerOverrides = JSON.parse(message.Body)

  cluster.runTask(containerOverrides).then(() => {
    const params = {
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle
    }
    sqs.deleteMessage(params, (err) => {
      if (err) {
        throw err
      }
    })
  }).catch(err => {
    error(err)
  })
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
