const nock = require("nock")

const mockBuildLogCallback = (url) => {
  const timeoutMessage = "The build timed out"
  const encodedTimeoutMessage = Buffer.from(timeoutMessage).toString("base64")
  const source = "Build scheduler"

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, { output: encodedTimeoutMessage, source })
    .reply(200)
}

module.exports = mockBuildLogCallback
