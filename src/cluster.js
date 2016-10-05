const AWS = require("./aws")

class Cluster {
  constructor() {
    this.capacity = process.env.MAX_TASKS || 1
    this._ecs = new AWS.ECS()
  }

  countAvailableNodes() {
    const params = this._ecsDescriptionParams()

    return new Promise((resolve, reject) => {
      this._ecs.describeClusters(params, (err, data) => {
        if (err) {
          reject(err)
        } else if (data.clusters.length == 0) {
          reject(new ClusterNotPresentInECSCallbackError())
        } else {
          const cluster = data.clusters[0]
          const busyNodeCount = cluster.runningTasksCount + cluster.pendingTasksCount
          resolve(this.capacity - busyNodeCount)
        }
      })
    })
  }

  runTask(containerOverrides) {
    const params = this._ecsTaskParams(containerOverrides)

    return new Promise((resolve, reject) => {
      this._ecs.runTask(params, (err, data) => {
        if (err) {
          reject(err)
        } else if (data.tasks.length == 0) {
          reject(new TaskNotPresentInECSCallbackError())
        } else {
          resolve(data.tasks[0])
        }
      })
    })
  }

  _ecsClustName() {
    return process.env.ECS_CLUSTER || "default"
  }

  _ecsDescriptionParams() {
    return {
      clusters: [ this._ecsClustName() ]
    }
  }

  _ecsTaskDefinition() {
    return process.env.ECS_TASK
  }

  _ecsTaskParams(containerOverrides) {
    return {
      taskDefinition: this._ecsTaskDefinition(),
      cluster: this._ecsClustName(),
      overrides: { containerOverrides: [ containerOverrides ] }
    }
  }
}

class ClusterNotPresentInECSCallbackError extends Error {
  constructor() {
    super("ECS.DescribeClusters called back with a response that did not include any clusters")
  }
}

class TaskNotPresentInECSCallbackError extends Error {
  constructor() {
    super("ECS.RunTask called back with a response that did not include any tasks")
  }
}

module.exports = Cluster
