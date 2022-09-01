const bullQueue = require('../src/bull-queue');

const testAddActiveJobToQueue = (queueName, jobData, testMethod) => {
  const testQueue = bullQueue(queueName);
  return testQueue.addBulk(jobData)
    .then(() => testQueue.getNextJob())
    .then((job) => job.progress({ state: 'active' }))
    .then(() => testMethod(testQueue))
    .then(() => testQueue.obliterate({ force: true }))
    .then(() => testQueue.empty())
    .then(() => testQueue.close());
};

const testAddJobsToQueue = (queueName, jobData, testMethod) => {
  const testQueue = bullQueue(queueName);
  return testQueue.addBulk(jobData)
    .then(() => testMethod(testQueue))
    .then(() => testQueue.empty())
    .then(() => testQueue.close());
};

const testEmptyQueue = (queueName, testMethod) => {
  const testQueue = bullQueue(queueName, { settings: { drainDelay: 1 } });
  return testMethod(testQueue)
    .then(() => testQueue.empty())
    .then(() => testQueue.close());
};

module.exports = {
  testAddActiveJobToQueue,
  testAddJobsToQueue,
  testEmptyQueue,
};
