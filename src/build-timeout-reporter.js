const request = require("request")
const winston = require("winston")

class BuildTimeoutReporter {
  constructor(build) {
    this._build = build
  }

  reportBuildTimeout() {
    return Promise.all([
      this._sendBuildLogRequest(),
      this._sendBuildStatusRequest(),
    ]).catch(err => {
      winston.error("Error reporting build timeout:", err)
    })
  }

  _request(method, url, body) {
    return new Promise((resolve, reject) => {
      request({
        method: method.toUpperCase(),
        url,
        json: body,
      }, (error, response, body) => {
        if (error) {
          reject(error)
        } else if (response.statusCode > 399) {
          let errorMessage = `Received status code: ${response.statusCode}`
          reject(new Error(body || errorMessage))
        } else {
          resolve(body)
        }
      })
    })
  }

  _sendBuildLogRequest() {
    const url = this._build.containerEnvironment.LOG_CALLBACK
    return this._request("POST", url, {
      message: "The build timed out",
      source: "Build scheduler",
    })
  }

  _sendBuildStatusRequest() {
    const url = this._build.containerEnvironment.STATUS_CALLBACK
    return this._request("POST", url, {
      message: Buffer.from("The build timed out").toString("base64"),
      status: "1",
    })
  }
}

module.exports = BuildTimeoutReporter
