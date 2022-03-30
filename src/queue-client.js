const QUEUE_ATTRIBUTES_FALLBACK = 'Queue attributes unavailable.';
const jobNotFound = id => `Job ${id} not found.`;

class QueueClient {
  constructor(bullQueue) {
    this._queue = bullQueue;
  }

  deleteMessage(message) {
    const { id } = message;
    return this._queue.getJob(id)
      .then((job) => {
        if (job === null) {
          const error = jobNotFound(id);
          throw new Error(error);
        }

        return job.moveToCompleted(`Job ${id} completed`, true, true);
      })
      .then(() => message);
  }

  getQueueAttributes(attributesArray = []) {
    return this._queue.getJobCounts()
      .then((jobCounts) => {
        const output = this._queueAvailableAttributes(jobCounts, attributesArray);
        return output;
      })
      .catch(() => ({ error: QUEUE_ATTRIBUTES_FALLBACK }));
  }

  receiveMessage() {
    return this._queue.getNextJob()
      .then((job) => {
        if (!job) return undefined;

        const {
          id,
          data,
          timestamp,
          processedOn,
          failedReason,
        } = job;

        return {
          id,
          data,
          timestamp,
          processedOn,
          failedReason,
        };
      });
  }

  extractMessageData(message) {
    return message.data;
  }

  _queueAvailableAttributes(jobCounts, attributesArray) {
    const output = {};
    const availableAttributes = Object.keys(jobCounts)
      .filter((key) => {
        if (attributesArray.length === 0) {
          return true;
        }

        return attributesArray.indexOf(key) !== -1;
      });

    if (availableAttributes.length === 0) {
      throw new Error();
    }

    availableAttributes.map(
      attribute => Object.assign(output, { [attribute]: jobCounts[attribute] })
    );

    return output;
  }
}

module.exports = QueueClient;
