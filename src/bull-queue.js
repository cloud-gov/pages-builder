const Queue = require('bull');
const appEnv = require('../env');

const bullQueue = (queueName = appEnv.queueName) => {
  const redisUrl = appEnv.redisUrl;
  return new Queue(queueName, redisUrl);
};

module.exports = bullQueue;
