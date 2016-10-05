process.env.SQS_URL = "https://sqs.us-east-1.amazonaws.com/123abc/456def"

let expect = require("chai").expect
let SQSClient = require("../src/sqs-client")

describe("SQSClient", () => {
  describe(".receiveMessage()", () => {
    it("should call SQS.ReceiveMessage and responds with a message", (done) => {
      const message = {
        Body: JSON.stringify({
          environment: [
            { name: "key", value: "value" }
          ],
          name: "builder"
        }),
      }

      const sqsClient = new SQSClient()

      sqsClient._sqs.receiveMessage = (params, callback) => {
          callback(null, { Messages: [ message ] })
      }

      sqsClient.receiveMessage().then(receivedMessage => {
        expect(receivedMessage).to.deep.equal(message)
        done()
      })
    })

    it("should call SQS.ReceiveMessage and respond with undefined if there are no messages", (done) => {
      const sqsClient = new SQSClient()

      sqsClient._sqs.receiveMessage = (params, callback) => {
          callback(null, { Messages: [] })
      }

      sqsClient.receiveMessage().then(receivedMessage => {
        expect(receivedMessage).to.deep.be.undefined
        done()
      })
    })

    it("should call SQS.ReceiveMessage and reject with an error if SQS responds with an error", (done) => {
      const sqsClient = new SQSClient()

      sqsClient._sqs.receiveMessage = (params, callback) => {
        callback(new Error("test error"), { Messages: [] })
      }

      sqsClient.receiveMessage().catch(error => {
        expect(error.message).to.equal("test error")
        done()
      })
    })

    it("should call SQS.ReceiveMessage with the correct queue URL", (done) => {
      const sqsClient = new SQSClient()

      sqsClient._sqs.receiveMessage = (params, callback) => {
        expect(params.QueueUrl).to.equal(process.env.SQS_URL)
        done()
      }

      sqsClient.receiveMessage({})
    })
  })

  describe(".deleteMessage(message)", () => {
    it("should call SQS.DeleteMessage with the message's receipt handle", (done) => {
      const message = {
        ReceiptHandle: "mocked-receipt-handle",
      }

      const sqsClient = new SQSClient()

      sqsClient._sqs.deleteMessage = (params, callback) => {
        expect(params.ReceiptHandle).to.equal("mocked-receipt-handle")
        done()
      }

      sqsClient.deleteMessage(message)
    })

    it("should call SQS.DeleteMessage and reject with an error if SQS response with an error", (done) => {
      const sqsClient = new SQSClient()

      sqsClient._sqs.deleteMessage = (params, callback) => {
        callback(new Error("test error"))
      }

      sqsClient.deleteMessage({}).catch(error => {
        expect(error.message).to.equal("test error")
        done()
      })
    })

    it("should call SQS.DeleteMessage with the correct queue URL", (done) => {
      const sqsClient = new SQSClient()

      sqsClient._sqs.deleteMessage = (params, callback) => {
        expect(params.QueueUrl).to.equal(process.env.SQS_URL)
        done()
      }

      sqsClient.deleteMessage({})
    })
  })
})
