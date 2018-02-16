const { expect } = require('chai');
const SQSClient = require('../src/sqs-client');

describe('SQSClient', () => {
  let sqsClient;

  beforeEach(() => {
    sqsClient = new SQSClient();
  });

  afterEach(() => {
    sqsClient = null;
  });

  describe('.receiveMessage()', () => {
    it('should call SQS.ReceiveMessage and responds with a message', (done) => {
      const message = {
        Body: JSON.stringify({
          environment: [
            { name: 'key', value: 'value' },
          ],
          name: 'builder',
        }),
      };

      sqsClient._sqs.receiveMessage = (params, callback) => {
        callback(null, { Messages: [message] });
      };

      sqsClient.receiveMessage().then((receivedMessage) => {
        expect(receivedMessage).to.deep.equal(message);
        done();
      });
    });

    it('should call SQS.ReceiveMessage and respond with undefined if there are no messages', (done) => {
      sqsClient._sqs.receiveMessage = (params, callback) => {
        callback(null, { Messages: [] });
      };

      sqsClient.receiveMessage().then((receivedMessage) => {
        expect(receivedMessage).to.deep.be.undefined;
        done();
      });
    });

    it('should call SQS.ReceiveMessage and reject with an error if SQS responds with an error', (done) => {
      sqsClient._sqs.receiveMessage = (params, callback) => {
        callback(new Error('test error'), { Messages: [] });
      };

      sqsClient.receiveMessage().catch((error) => {
        expect(error.message).to.equal('test error');
        done();
      });
    });

    it('should call SQS.ReceiveMessage with the correct queue URL', (done) => {
      sqsClient._sqs.receiveMessage = (params) => {
        expect(params.QueueUrl).to.equal(process.env.SQS_URL);
        done();
      };

      sqsClient.receiveMessage({});
    });
  });

  describe('.deleteMessage(message)', () => {
    it("should call SQS.DeleteMessage with the message's receipt handle", (done) => {
      const message = {
        ReceiptHandle: 'mocked-receipt-handle',
      };

      sqsClient._sqs.deleteMessage = (params) => {
        expect(params.ReceiptHandle).to.equal('mocked-receipt-handle');
        done();
      };

      sqsClient.deleteMessage(message);
    });

    it('should call SQS.DeleteMessage and reject with an error if SQS response with an error', (done) => {
      sqsClient._sqs.deleteMessage = (params, callback) => {
        callback(new Error('test error'));
      };

      sqsClient.deleteMessage({}).catch((error) => {
        expect(error.message).to.equal('test error');
        done();
      });
    });

    it('should call SQS.DeleteMessage with the correct queue URL', (done) => {
      sqsClient._sqs.deleteMessage = (params) => {
        expect(params.QueueUrl).to.equal(process.env.SQS_URL);
        done();
      };

      sqsClient.deleteMessage({});
    });
  });

  describe('.getQueueAttributes', () => {
    it('calls function with the correct queue url', (done) => {
      sqsClient._sqs.getQueueAttributes = (params) => {
        expect(params.QueueUrl).to.equal(process.env.SQS_URL);
        done();
      };

      sqsClient.getQueueAttributes('ApproximateNumberOfMessages');
    });

    it('returns an error object when SQS is unavailable', (done) => {
      sqsClient._sqs.getQueueAttributes = (params, callback) => {
        callback(true);
      };

      sqsClient.getQueueAttributes('').then((response) => {
        expect(response).to.deep.equal({ error: 'queue attributes unavailable' });
        done();
      });
    });

    it('returns an object of all requested attributes', (done) => {
      const expected = { Attributes: { ApproximateNumberOfMessages: 1 } };

      sqsClient._sqs.getQueueAttributes = (params, callback) => {
        callback(false, expected);
      };

      sqsClient.getQueueAttributes('ApproximateNumberOfMessages').then((response) => {
        expect(response).to.deep.equal(expected.Attributes);
        done();
      });
    });
  });
});
