const AWS = require('./aws');

const QUEUE_ATTRIBUTES_FALLBACK = 'queue attributes unavailable';

class SQSClient {
  constructor() {
    this._sqs = new AWS.SQS();
  }

  getQueueAttributes(...attributes) {
    return new Promise((resolve) => {
      this._sqs.getQueueAttributes(
        this._queueAttributesParams(...attributes),
        (error, data) => {
          let output;

          if (!error) {
            output = data.Attributes;
          } else {
            output = { error: QUEUE_ATTRIBUTES_FALLBACK };
          }

          resolve(output);
        }
      );
    });
  }

  receiveMessage() {
    const params = this._sqsReceiveMessageParams();

    return new Promise((resolve, reject) => {
      this._sqs.receiveMessage(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          let message;
          if (data && data.Messages && data.Messages[0]) {
            message = data.Messages[0];
          }
          resolve(message);
        }
      });
    });
  }

  deleteMessage(message) {
    const params = this._sqsDeleteMessageParams(message);

    return new Promise((resolve, reject) => {
      this._sqs.deleteMessage(params, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(message);
        }
      });
    });
  }

  _queueAttributesParams(attributes) {
    return {
      QueueUrl: this._sqsQueueURL(),
      AttributeNames: [...attributes],
    };
  }

  _sqsDeleteMessageParams(message) {
    return {
      QueueUrl: this._sqsQueueURL(),
      ReceiptHandle: message.ReceiptHandle,
    };
  }

  _sqsQueueURL() {
    return process.env.SQS_URL;
  }

  _sqsReceiveMessageParams() {
    return {
      QueueUrl: this._sqsQueueURL(),
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
    };
  }
}

module.exports = SQSClient;
