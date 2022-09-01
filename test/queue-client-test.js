const { expect } = require('chai');
const QueueClient = require('../src/queue-client');
const {
  testAddActiveJobToQueue,
  testAddJobsToQueue,
  testEmptyQueue,
} = require('./helpers');

const jobKeys = [
  'id',
  'data',
  'timestamp',
  'processedOn',
  'failedReason',
];

const mockQueue = (queue, output) => ({
  getJobCounts: () => new Promise((resolve) => { resolve(output); }),
  ...queue,
});

describe('QueueClient', () => {
  describe('.receiveMessage()', () => {
    it('should receive a message from the queue', () => {
      const queueName = 'received-message';
      const jobData = [{
        data: { test: 'data', job_id: 1 },
      }];
      const testMethod = (queue) => {
        const queueClient = new QueueClient(queue);
        return queueClient.receiveMessage()
          .then((response) => {
            expect(response).to.have.keys(jobKeys);
            expect(response.data).to.deep.equal(jobData[0].data);
          });
      };

      return testAddJobsToQueue(queueName, jobData, testMethod);
    });

    it('should check the active jobs if there are no new jobs waiting in the queue', () => {
      const queueName = 'active-message';
      const jobData = [{
        data: { test: 'data', job_id: 1 },
      }];
      const testMethod = (queue) => {
        const queueClient = new QueueClient(queue);
        return queueClient.receiveMessage()
          .then((response) => {
            expect(response).to.have.keys(jobKeys);
            expect(response.data).to.deep.equal(jobData[0].data);
          });
      };

      return testAddActiveJobToQueue(queueName, jobData, testMethod);
    });

    it('should receive a the FIFO message from the queue', () => {
      const queueName = 'received-messages';
      const jobData = [{
        data: { test: 'a job', job_id: 1 },
      }, {
        data: { test: 'another job', job_id: 2 },
      }, {
        data: { test: 'another job again', job_id: 3 },
      }];
      const testMethod = (queue) => {
        const queueClient = new QueueClient(queue);
        return queueClient.receiveMessage()
          .then((response) => {
            expect(response).to.have.keys(jobKeys);
            expect(response.data).to.deep.equal(jobData[0].data);
          });
      };

      return testAddJobsToQueue(queueName, jobData, testMethod);
    });

    it('should respond with undefined if there are no messages after 1 second', () => {
      const queueName = 'no-messages';
      const testMethod = (queue) => {
        const queueClient = new QueueClient(queue);
        return queueClient.receiveMessage()
          .then((response) => {
            expect(response).to.deep.be.undefined;
          });
      };

      return testEmptyQueue(queueName, testMethod);
    });
  });

  describe('.deleteMessage(message)', () => {
    it('should delete queue job message', () => {
      const queueName = 'delete-message-not-found';
      const deleteJobId = 'my-delete-job';
      const jobData = [{
        data: { test: 'a job', job_id: 1 },
      }, {
        data: { test: 'another job', job_id: 2 },
        opts: { jobId: deleteJobId },
      }, {
        data: { test: 'another job again', job_id: 3 },
      }];
      const message = { id: deleteJobId, ...jobData[1] };
      const testMethod = (queue) => {
        const queueClient = new QueueClient(queue);
        return queueClient.deleteMessage(message)
          .then((response) => {
            expect(response).to.deep.equal(message);
          })
          .then(() => queue.getJobCounts())
          .then(counts => expect(counts.completed).to.equal(1));
      };

      return testAddJobsToQueue(queueName, jobData, testMethod);
    });

    it('should reject with an error if queue job does not exist', () => {
      const queueName = 'delete-message-not-found';
      const notMessage = { id: 'not an id' };
      const jobData = [{
        data: { test: 'a job', job_id: 1 },
      }, {
        data: { test: 'another job', job_id: 2 },
      }, {
        data: { test: 'another job again', job_id: 3 },
      }];
      const testMethod = (queue) => {
        const queueClient = new QueueClient(queue);
        return queueClient.deleteMessage(notMessage)
          .catch((err) => {
            expect(err).to.be.an('error');
          });
      };

      return testAddJobsToQueue(queueName, jobData, testMethod);
    });
  });

  describe('.getQueueAttributes', () => {
    it('returns an error object when Queue is unavailable', () => {
      const queueClient = new QueueClient(
        mockQueue({ getJobCounts: () => new Promise((_, reject) => { reject(); }) })
      );

      return queueClient.getQueueAttributes().then((response) => {
        expect(response).to.deep.equal({ error: 'Queue attributes unavailable.' });
      });
    });

    it('returns an error object when attributes are unavailable in response', () => {
      const unavailableAttributes = ['not-an-option', 'alsobad'];
      const allAttributes = {
        waiting: 1,
        active: 10,
      };

      const queueClient = new QueueClient(
        mockQueue({}, allAttributes)
      );

      return queueClient.getQueueAttributes(unavailableAttributes).then((response) => {
        expect(response).to.deep.equal({ error: 'Queue attributes unavailable.' });
      });
    });

    it('returns an object of all attributes by default', () => {
      const expected = {
        waiting: 1,
        active: 10,
        completed: 100,
        failed: 5,
        delayed: 1,
      };

      const queueClient = new QueueClient(
        mockQueue({}, expected)
      );

      return queueClient.getQueueAttributes().then((response) => {
        expect(response).to.deep.equal(expected);
      });
    });

    it('returns an object subset all requested attributes', () => {
      const requestedAttributes = ['waiting', 'active'];
      const allAttributes = {
        waiting: 1,
        active: 10,
        completed: 100,
        failed: 5,
        delayed: 1,
      };

      const expected = {
        waiting: 1,
        active: 10,
      };

      const queueClient = new QueueClient(
        mockQueue({}, allAttributes)
      );

      return queueClient.getQueueAttributes(requestedAttributes).then((response) => {
        expect(response).to.deep.equal(expected);
      });
    });

    it('returns an object subset available requested attributes', () => {
      const requestedAttributes = ['waiting', 'active', 'not-an-attribute'];
      const allAttributes = {
        waiting: 1,
        active: 10,
        completed: 100,
        failed: 5,
        delayed: 1,
      };

      const expected = {
        waiting: 1,
        active: 10,
      };

      const queueClient = new QueueClient(
        mockQueue({}, allAttributes)
      );

      return queueClient.getQueueAttributes(requestedAttributes).then((response) => {
        expect(response).to.deep.equal(expected);
      });
    });

    it('returns an object when preloading the queue', () => {
      const queueName = 'queue-attributes';
      const jobCountKeys = [
        'active',
        'completed',
        'delayed',
        'failed',
        'paused',
        'waiting',
      ];
      const jobData = [{
        data: { test: 'a job', job_id: 1 },
      }, {
        data: { test: 'another job', job_id: 2 },
      }, {
        data: { test: 'another job again', job_id: 3 },
      }];

      const testMethod = (queue) => {
        const queueClient = new QueueClient(queue);

        return queueClient.getQueueAttributes().then((response) => {
          expect(response).to.have.keys(jobCountKeys);
          expect(response.waiting).to.equal(jobData.length);
        });
      };

      return testAddJobsToQueue(queueName, jobData, testMethod);
    });
  });

  describe('.extractMessageData(message)', () => {
    it('returns the build data', () => {
      const queueClient = new QueueClient(null);
      const message = {
        data: {
          environment: [
            { name: 'key', value: 'value' },
          ],
          name: 'builder',
        },
      };

      const data = queueClient.extractMessageData(message);

      expect(data.name).to.eq('builder');
      expect(data.environment[0].name).to.eq('key');
    });
  });
});
