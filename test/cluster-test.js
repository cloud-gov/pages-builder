process.env.ECS_TASK = "federalist-builder"
process.env.ECS_CLUSTER = "default"
process.env.MAX_TASKS = 10

const expect = require("chai").expect
const Cluster = require("../src/cluster")

describe("Cluster", () => {
  describe(".runTask(containerOverrides)", () => {
    it("should call ECS.RunTask with the given container overrides", (done) => {
      const containerOverrides = {
        environment: [
          { name: "key", value: "value" }
        ],
        name: "builder"
      }

      const cluster = new Cluster()
      cluster._ecs.runTask = (params, callback) => {
        const containerOverridesFromParams = params.overrides.containerOverrides[0]
        expect(containerOverridesFromParams).to.equal(containerOverrides)
        done()
      }

      cluster.runTask(containerOverrides)
    })

    it("should call ECS.RunTask and reject with an error if ECS returns an error", (done) => {
      const cluster = new Cluster()
      cluster._ecs.runTask = (params, callback) => {
        callback(new Error("test error"))
      }

      cluster.runTask({}).catch(error => {
        expect(error.message).to.match(/test error/)
        done()
      })
    })

    it("should call ECS.RunTask with the correct task definition and cluster name", (done) => {
      const cluster = new Cluster()
      cluster._ecs.runTask = (params, callback) => {
        expect(params.taskDefinition).to.equal(process.env.ECS_TASK)
        expect(params.cluster).to.equal(process.env.ECS_CLUSTER)
        done()
      }

      cluster.runTask({})
    })
  })

  describe(".countAvailableNodes()", () => {
    it("should call ECS.DescribeCluster and resolve with the number of available nodes", (done) => {
      const cluster = new Cluster()

      cluster._ecs.describeClusters = (params, callback) => {
        const data = {
          clusters: [
            {
              runningTasksCount: 2,
              pendingTasksCount: 3,
            }
          ]
        }
        callback(null, data)
      }

      cluster.countAvailableNodes().then(nodeCount => {
        expect(nodeCount).to.equal(5)
        done()
      })
    })

    it("should call ECS.DescribeCluster and reject with an error if ECS responds with an error", (done) => {
      const cluster = new Cluster()

      cluster._ecs.describeClusters = (params, callback) => {
        callback(new Error("test error"))
      }

      cluster.countAvailableNodes().catch(error => {
        expect(error.message).to.match(/test error/)
        done()
      })
    })

    it("should call ECS.DescribeCluster on the correct cluster", (done) => {
      const cluster = new Cluster()

      cluster._ecs.describeClusters = (params, callback) => {
        expect(params.clusters).to.deep.equal([process.env.ECS_CLUSTER])
        done()
      }

      cluster.countAvailableNodes()
    })
  })
})
