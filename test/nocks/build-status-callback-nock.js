const nock = require("nock")

const mockBuildStatusCallback = (url) => {
  const timeoutMessage = "The build timed out"
  const encodedTimeoutMessage = Buffer.from(timeoutMessage).toString("base64")

  return nock(`${url.protocol}//${url.hostname}`)
    .post(url.path, {
      status: "1",
      message: encodedTimeoutMessage,
    })
    .reply(200)
}

module.exports = mockBuildStatusCallback
