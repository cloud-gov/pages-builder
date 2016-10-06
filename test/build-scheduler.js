process.env.SQS_URL = "https://sqs.us-east-1.amazonaws.com/123abc/456def"
process.env.ECS_CLUSTER = "ECS_CLUSTER"
process.env.ECS_TASK = "federalist-builder"
process.env.MAX_TASKS = 10
process.env.PORT = 3000

const expect = require("chai").expect
const BuildScheduler = require("../src/build-scheduler")

describe("BuildScheduler", () => {
  it("it should run a task when a message is received from SQS and then delete the message", (done) => {
    let hasReceivedMessage = false
    const sqs = {}
    sqs.receiveMessage = (params, callback) => {
      if (!hasReceivedMessage) {
        hasReceivedMessage = true
        callback(null, {
          Messages: [
            {
              Body: "{}"
            }
          ]
        })
      } else {
        mockedSQSReceiveMessage(params, callback)
      }
    }

    let hasDeletedMessage = false
    sqs.deleteMessage = (params, callback) => {
      hasDeletedMessage = true
      mockedSQSDeleteMessage(params, callback)
    }

    let hasRunTask = false
    const ecs = {}
    ecs.runTask = (params, callback) => {
      hasRunTask = true
      mockedECSRunTask(params, callback)
    }

    const buildScheduler = new BuildScheduler()
    mockECSServices(buildScheduler, { sqs, ecs })
    buildScheduler.start()

    setImmediate(() => {
      expect(hasReceivedMessage).to.equal(true)
      expect(hasRunTask).to.equal(true)
      expect(hasDeletedMessage).to.equal(true)
      buildScheduler.stop()
      done()
    })
  })

  it("should not run more tasks than the cluster can handle", (done) => {
    let receivedMessageCount = 0
    const sqs = {}
    sqs.receiveMessage = (params, callback) => {
      receivedMessageCount++
      callback(null, {
        Messages: [
          {
            Body: "{}"
          }
        ]
      })
    }

    let runningTasksCount = 0
    const ecs = {}
    ecs.runTask = (params, callback) => {
      runningTasksCount++
      mockedECSRunTask(params, callback)
    }
    ecs.describeClusters = (params, callback) => callback(null, {
      clusters: [
        {
          runningTasksCount: runningTasksCount,
          pendingTasksCount: 0,
        },
      ],
    })

    const buildScheduler = new BuildScheduler()
    mockECSServices(buildScheduler, { sqs, ecs })
    buildScheduler.start()

    setTimeout(() => {
      expect(receivedMessageCount).to.be.above(10)
      expect(runningTasksCount).to.equal(10)
      buildScheduler.stop()
      done()
    }, 250)
  })
})

const mockECSServices = (buildScheduler, { sqs, ecs }) => {
  buildScheduler._sqsClient._sqs = Object.assign({
    receiveMessage: mockedSQSReceiveMessage,
    deleteMessage: mockedSQSDeleteMessage,
  }, sqs)
  buildScheduler._cluster._ecs = Object.assign({
    describeClusters: mockedECSDescribeClusters,
    runTask: mockedECSRunTask,
  }, ecs)
}

const mockedSQSReceiveMessage = (params, callback) => callback(null, {
  Messages: [],
})

const mockedSQSDeleteMessage = (params, callback) => callback()

const mockedECSDescribeClusters = (params, callback) => callback(null, {
  clusters: [
    {
      runningTasksCount: 0,
      pendingTasksCount: 0,
    },
  ],
})

const mockedECSRunTask = (params, callback) => callback(null, { tasks: [{}] })
