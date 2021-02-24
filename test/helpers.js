const bullQueue = require('../src/bull-queue');

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
  testAddJobsToQueue,
  testEmptyQueue,
};
