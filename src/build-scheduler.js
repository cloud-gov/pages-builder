const Cluster = require("./cluster")
const SQSClient = require("./sqs-client")

class BuildScheduler {
  constructor() {
    this._cluster = new Cluster()
    this._sqsClient = new SQSClient()
  }

  start() {
    this.running = true
    this._run()
  }

  stop() {
    this.running = false
  }

  _run() {
    this._findAndScheduleNewBuild().catch(error => {
      console.error(error)
    }).then(() => {
      if (this.running) {
        setImmediate(() => {
          this._run()
        })
      }
    })
  }

  _attemptToRunTaskForMessage(message) {
    return this._cluster.countAvailableNodes().then(availableNodes => {
      if (availableNodes > 0) {
        return this._runTaskAndDeleteMessage(message)
      }
    })
  }

  _containerOverridesForMessage(message) {
    return JSON.parse(message.Body)
  }

  _findAndScheduleNewBuild() {
    return this._sqsClient.receiveMessage().then(message => {
      if (message) {
        return this._attemptToRunTaskForMessage(message)
      }
    })
  }

  _runTaskAndDeleteMessage(message) {
    const containerOverrides = this._containerOverridesForMessage(message)
    return this._cluster.runTask(containerOverrides).then(() => {
      return this._sqsClient.deleteMessage(message)
    })
  }
}

module.exports = BuildScheduler
