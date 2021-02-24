const Queue = require('bull');
const appEnv = require('../env');

const bullQueue = (
  queueName = appEnv.queueName,
  {
    createClient,
    redis,
    limiter,
    prefix,
    defaultJobOptions,
    settings,
  } = {}
) => {
  const redisUrl = appEnv.redisUrl;
  const updatedSettings = { drainDelay: 20, ...settings };

  return new Queue(queueName, redisUrl, {
    createClient,
    redis,
    limiter,
    prefix,
    defaultJobOptions,
    settings: updatedSettings,
  });
};

module.exports = bullQueue;
