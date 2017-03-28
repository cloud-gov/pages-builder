const nock = require("nock")

const mockBuildLogCallback = (url) => {
  const output = "The build timed out"
  const source = "Build scheduler"

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, { output, source })
    .reply(200)
}

module.exports = mockBuildLogCallback
