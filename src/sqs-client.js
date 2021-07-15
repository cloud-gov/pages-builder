const QUEUE_ATTRIBUTES_FALLBACK = 'Queue attributes unavailable.';

class SQSClient {
  constructor(sqs, queueURL) {
    this._sqs = sqs;
    this._sqsQueueURL = queueURL;
  }

  getQueueAttributes(attributesArray) {
    // attributesArray should be an array of SQS attribute names
    // ref: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_GetQueueAttributes.html
    return new Promise((resolve) => {
      this._sqs.getQueueAttributes(
        this._queueAttributesParams(attributesArray),
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

  extractMessageData(message) {
    return JSON.parse(message.Body);
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

  _queueAttributesParams(attributesArray) {
    return {
      QueueUrl: this._sqsQueueURL,
      AttributeNames: attributesArray,
    };
  }

  _sqsDeleteMessageParams(message) {
    return {
      QueueUrl: this._sqsQueueURL,
      ReceiptHandle: message.ReceiptHandle,
    };
  }

  _sqsReceiveMessageParams() {
    return {
      QueueUrl: this._sqsQueueURL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
    };
  }
}

module.exports = SQSClient;
