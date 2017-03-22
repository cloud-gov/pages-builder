const expect = require("chai").expect
const nock = require("nock")
const url = require("url")

const Cluster = require("../src/cluster")

const mockBuildLogCallback = require("./nocks/build-log-callback-nock")
const mockBuildStatusCallback = require("./nocks/build-status-callback-nock")
const mockListAppsRequest = require("./nocks/cloud-foundry-list-apps-nock")
const mockRestageAppRequest = require("./nocks/cloud-foundry-restage-app-nock")
const mockTokenRequest = require("./nocks/cloud-foundry-oauth-token-nock")
const mockUpdateAppRequest = require("./nocks/cloud-foundry-update-app-nock")

describe("Cluster", () => {
  afterEach(() => nock.cleanAll())

  describe(".countAvailableContainers()", () => {
    it("should return the number of available containers", done => {
      mockTokenRequest()
      mockListAppsRequest(Array(10).fill({}))

      const cluster = new Cluster()
      cluster.start()

      setTimeout(() => {
        expect(cluster.countAvailableContainers()).to.eq(10)
        done()
      }, 50)
    })
  })

  describe(".startBuild(build)", () => {
    it("should update and restage a container", done => {
      mockTokenRequest()
      mockListAppsRequest([{}])

      const mockedUpdateRequest = mockUpdateAppRequest()
      const mockedRestageRequest = mockRestageAppRequest()

      const cluster = new Cluster()
      mockServer(cluster)
      cluster.start()

      setTimeout(() => {
        cluster.startBuild({
          buildID: "123abc",
          containerEnvironment: {},
        })
        setTimeout(() => {
          expect(mockedUpdateRequest.isDone()).to.eq(true)
          expect(mockedRestageRequest.isDone()).to.eq(true)
          done()
        }, 50)
      }, 50)
    })

    it("should reduce the number of available containers by 1", done => {
      mockTokenRequest()
      mockListAppsRequest([{}])
      mockUpdateAppRequest()
      mockRestageAppRequest()

      const cluster = new Cluster()
      mockServer(cluster)
      cluster.start()

      setTimeout(() => {
        expect(cluster.countAvailableContainers()).to.eq(1)
        cluster.startBuild({
          buildID: "123abc",
          containerEnvironment: {},
        })
        setTimeout(() => {
          expect(cluster.countAvailableContainers()).to.eq(0)
          done()
        }, 50)
      }, 50)
    })

    it("should not reduce the number of containers by 1 if it fails to start the build", done => {
      mockTokenRequest()
      mockListAppsRequest([{ guid: "fake-container" }])
      mockUpdateAppRequest()

      nock("https://api.example.com").post(
        "/v2/apps/fake-container/restage"
      ).reply(500)

      const cluster = new Cluster()
      mockServer(cluster)
      cluster.start()

      setTimeout(() => {
        expect(cluster.countAvailableContainers()).to.eq(1)
        cluster.startBuild({
          buildID: "123abc",
          containerEnvironment: {},
        })
        setTimeout(() => {
          expect(cluster.countAvailableContainers()).to.eq(1)
          done()
        }, 50)
      }, 50)
    })
  })

  describe(".stopBuild(buildID)", () => {
    const logCallbackURL = url.parse("https://www.example.gov/log")
    const statusCallbackURL = url.parse("https://www.example.gov/status")
    let logCallbackNock
    let statusCallbackNock

    beforeEach(() => {
      logCallbackNock = mockBuildLogCallback(logCallbackURL)
      statusCallbackNock = mockBuildStatusCallback(statusCallbackURL)
    })

    afterEach(() => {
      nock.cleanAll()
    })

    it("should make the build for the given buildID available", () => {
      const cluster = new Cluster()

      cluster._containers = [
        {
          guid: "123abc",
          build: {
            buildID: "456def",
            containerEnvironment: {
              LOG_CALLBACK: logCallbackURL.href,
              STATUS_CALLBACK: statusCallbackURL.href,
            },
          },
        },
        {
          guid: "789ghi",
          build: undefined
        },
      ]

      cluster.stopBuild("456def")

      container = cluster._containers.find(container => container.guid === "123abc")

      expect(container).to.be.a("object")
      expect(container.build).to.be.undefined
    })

    it("should send a request to the build's log and status callback", done => {
      const cluster = new Cluster()

      cluster._containers = [
        {
          guid: "123abc",
          build: {
            buildID: "456def",
            containerEnvironment: {
              LOG_CALLBACK: logCallbackURL.href,
              STATUS_CALLBACK: statusCallbackURL.href,
            },
          }
        }
      ]

      cluster.stopBuild("456def")

      setTimeout(() => {
        expect(logCallbackNock.isDone()).to.be.true
        expect(statusCallbackNock.isDone()).to.be.true
        done()
      }, 200)
    })
  })
})

const mockServer = (cluster) => {
  cluster._server.start = () => {}
}
