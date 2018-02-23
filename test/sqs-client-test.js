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

  const sqsMethodStub = (method, expectedResponse, error = null) => {
    const safeMethod = sqsClient._sqs[method];

    sqsClient._sqs[method] = (params, callback) => {
      callback(error, expectedResponse);
    };

    return () => { sqsClient._sqs[method] = safeMethod; };
  };

  const providesQueueUrl = (method, done) => {
    sqsClient._sqs[method] = (params) => {
      expect(params.QueueUrl).to.equal(process.env.SQS_URL);
      done();
    };
  };

  describe('.receiveMessage()', () => {
    let receiveMessageStub;

    afterEach(() => {
      if (receiveMessageStub) {
        receiveMessageStub();
        receiveMessageStub = null;
      }
    });

    it('should call SQS.ReceiveMessage and responds with a message', (done) => {
      const message = {
        Body: JSON.stringify({
          environment: [
            { name: 'key', value: 'value' },
          ],
          name: 'builder',
        }),
      };

      receiveMessageStub = sqsMethodStub('receiveMessage', { Messages: [message] });

      sqsClient.receiveMessage().then((receivedMessage) => {
        expect(receivedMessage).to.deep.equal(message);
        done();
      });
    });

    it('should call SQS.ReceiveMessage and respond with undefined if there are no messages', (done) => {
      receiveMessageStub = sqsMethodStub('receiveMessage', { Messages: [] });

      sqsClient.receiveMessage().then((receivedMessage) => {
        expect(receivedMessage).to.deep.be.undefined;
        done();
      });
    });

    it('should call SQS.ReceiveMessage and reject with an error if SQS responds with an error', (done) => {
      const errorMessage = 'test error';
      const messages = { Messages: [] };

      receiveMessageStub = sqsMethodStub('receiveMessage', messages, new Error(errorMessage));

      sqsClient.receiveMessage().catch((error) => {
        expect(error.message).to.equal(errorMessage);
        done();
      });
    });

    it('should call SQS.ReceiveMessage with the correct queue URL', (done) => {
      providesQueueUrl('receiveMessage', done);
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
      providesQueueUrl('deleteMessage', done);
      sqsClient.deleteMessage({});
    });
  });

  describe('.getQueueAttributes', () => {
    it('calls SQS.getQueueAttributes with the requested attributes', (done) => {
      sqsClient._sqs.getQueueAttributes = (params) => {
        expect(params.AttributeNames).to.deep.equal(['aa', 'bb', 'cc']);
        done();
      };

      sqsClient.getQueueAttributes(['aa', 'bb', 'cc']);
    });

    it('calls function with the correct queue url', (done) => {
      providesQueueUrl('getQueueAttributes', done);
      sqsClient.getQueueAttributes(['ApproximateNumberOfMessages']);
    });

    it('returns an error object when SQS is unavailable', (done) => {
      sqsClient._sqs.getQueueAttributes = (params, callback) => {
        callback(true);
      };

      sqsClient.getQueueAttributes(['boop']).then((response) => {
        expect(response).to.deep.equal({ error: 'queue attributes unavailable' });
        done();
      });
    });

    it('returns an object of all requested attributes', (done) => {
      const expected = { Attributes: { ApproximateNumberOfMessages: 1 } };

      sqsClient._sqs.getQueueAttributes = (params, callback) => {
        callback(false, expected);
      };

      sqsClient.getQueueAttributes(['ApproximateNumberOfMessages']).then((response) => {
        expect(response).to.deep.equal(expected.Attributes);
        done();
      });
    });
  });
});
