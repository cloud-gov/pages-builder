const { expect } = require('chai');
const SQSClient = require('../src/sqs-client');

const queueURL = 'QUEUE_URL';

const mockSQS = sqs => ({
  getQueueAttributes: (params, cb) => cb(null, { Attributes: {} }),
  receiveMessage: (params, cb) => cb(null, { Messages: [] }),
  deleteMessage: (params, cb) => cb(null),
  ...sqs,
});

describe('SQSClient', () => {
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

      const sqsClient = new SQSClient(
        mockSQS({ receiveMessage: (_, cb) => cb(null, { Messages: [message] }) }),
        queueURL
      );

      sqsClient.receiveMessage().then((receivedMessage) => {
        expect(receivedMessage).to.deep.equal(message);
        done();
      });
    });

    it('should call SQS.ReceiveMessage and respond with undefined if there are no messages', (done) => {
      const sqsClient = new SQSClient(
        mockSQS({ receiveMessage: (_, cb) => cb(null, { Messages: [] }) }),
        queueURL
      );

      sqsClient.receiveMessage().then((receivedMessage) => {
        expect(receivedMessage).to.deep.be.undefined;
        done();
      });
    });

    it('should call SQS.ReceiveMessage and reject with an error if SQS responds with an error', (done) => {
      const errorMessage = 'test error';

      const sqsClient = new SQSClient(
        mockSQS({ receiveMessage: (_, cb) => cb(new Error(errorMessage)) }),
        queueURL
      );

      sqsClient.receiveMessage().catch((error) => {
        expect(error.message).to.equal(errorMessage);
        done();
      });
    });

    it('should call SQS.ReceiveMessage with the correct queue URL', (done) => {
      const sqsClient = new SQSClient(
        mockSQS({
          receiveMessage: (params) => {
            expect(params.QueueUrl).to.equal(queueURL);
            done();
          },
        }),
        queueURL
      );

      sqsClient.receiveMessage({});
    });
  });

  describe('.deleteMessage(message)', () => {
    it("should call SQS.DeleteMessage with the message's receipt handle", (done) => {
      const message = {
        ReceiptHandle: 'mocked-receipt-handle',
      };

      const sqsClient = new SQSClient(
        mockSQS({
          deleteMessage: (params) => {
            expect(params.ReceiptHandle).to.equal('mocked-receipt-handle');
            done();
          },
        }),
        queueURL
      );

      sqsClient.deleteMessage(message);
    });

    it('should call SQS.DeleteMessage and reject with an error if SQS response with an error', (done) => {
      const sqsClient = new SQSClient(
        mockSQS({ deleteMessage: (_, cb) => cb(new Error('test error')) }),
        queueURL
      );

      sqsClient.deleteMessage({}).catch((error) => {
        expect(error.message).to.equal('test error');
        done();
      });
    });

    it('should call SQS.DeleteMessage with the correct queue URL', (done) => {
      const sqsClient = new SQSClient(
        mockSQS({
          deleteMessage: (params) => {
            expect(params.QueueUrl).to.equal(queueURL);
            done();
          },
        }),
        queueURL
      );

      sqsClient.deleteMessage({});
    });
  });

  describe('.getQueueAttributes', () => {
    it('calls SQS.getQueueAttributes with the requested attributes', (done) => {
      const attributesArray = ['aa', 'bb', 'cc'];

      const sqsClient = new SQSClient(
        mockSQS({
          getQueueAttributes: (params) => {
            expect(params.AttributeNames).to.deep.equal(attributesArray);
            done();
          },
        }),
        queueURL
      );

      sqsClient.getQueueAttributes(attributesArray);
    });

    it('calls function with the correct queue url', (done) => {
      const sqsClient = new SQSClient(
        mockSQS({
          getQueueAttributes: (params) => {
            expect(params.QueueUrl).to.equal(queueURL);
            done();
          },
        }),
        queueURL
      );

      sqsClient.getQueueAttributes();
    });

    it('returns an error object when SQS is unavailable', (done) => {
      const sqsClient = new SQSClient(
        mockSQS({ getQueueAttributes: (_, cb) => cb(new Error()) }),
        queueURL
      );

      sqsClient.getQueueAttributes().then((response) => {
        expect(response).to.deep.equal({ error: 'Queue attributes unavailable.' });
        done();
      });
    });

    it('returns an object of all requested attributes', (done) => {
      const expected = { Attributes: { ApproximateNumberOfMessages: 1 } };

      const sqsClient = new SQSClient(
        mockSQS({ getQueueAttributes: (_, cb) => cb(null, expected) }),
        queueURL
      );

      sqsClient.getQueueAttributes().then((response) => {
        expect(response).to.deep.equal(expected.Attributes);
        done();
      });
    });
  });
});
