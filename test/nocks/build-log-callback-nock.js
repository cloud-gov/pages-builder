const nock = require("nock")

const mockBuildLogCallback = (url) => {
  const message = "The build timed out"
  const source = "Build scheduler"

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, { message, source })
    .reply(200)
}

module.exports = mockBuildLogCallback
