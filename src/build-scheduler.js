const Build = require("./build")
const Cluster = require("./cluster")
const SQSClient = require("./sqs-client")

class BuildScheduler {
  constructor() {
    this._cluster = new Cluster()
    this._sqsClient = new SQSClient()
  }

  start() {
    this._cluster.start()
    this.running = true
    this._run()
  }

  stop() {
    this._cluster.stop()
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

  _attemptToStartBuild(build) {
    if (this._cluster.countAvailableContainers() > 0) {
      return this._startBuildAndDeleteMessage(build)
    }
  }

  _findAndScheduleNewBuild() {
    return this._sqsClient.receiveMessage().then(message => {
      if (message) {
        const build = new Build(message)
        return this._attemptToStartBuild(build)
      }
    })
  }

  _startBuildAndDeleteMessage(build) {
    return this._cluster.startBuild(build).then(() => {
      return this._sqsClient.deleteMessage(build.sqsMessage)
    })
  }
}

module.exports = BuildScheduler
