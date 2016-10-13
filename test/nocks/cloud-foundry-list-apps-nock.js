const crypto = require("crypto")
const nock = require("nock")

const mockListAppsRequest = (resources) => {
  return nock("https://api.example.com", {
    reqheaders: {
      "authorization": /Bearer .+/
    }
  }).get(
    `/v2/spaces/123abc-456def-789ghi/apps`
  ).reply(200, {
    resources: resources.map(expandResource)
  })
}

const expandResource = (resource) => {
  const guid = resource.guid || crypto.randomBytes(6).toString("hex")
  const name = resource.name || crypto.randomBytes(6).toString("hex")

  let dockerImage
  if (Object.keys(resource).indexOf("dockerImage") >= 0) {
    dockerImage = resource.dockerImage
  } else {
    dockerImage = "example.com:5000/builder/1"
  }

  return {
    metadata: {
      guid: guid,
      url: `/v2/apps/${guid}`,
    },
    entity: {
      name: name,
      docker_image: dockerImage,
    },
  }
}

module.exports = mockListAppsRequest
