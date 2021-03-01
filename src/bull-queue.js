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
  const updatedClient = createClient || 'client';
  const updatedRedis = { tls: appEnv.redisTls, ...redis };
  const updatedSettings = { drainDelay: 20, ...settings };

  return new Queue(queueName, redisUrl, {
    createClient: updatedClient,
    redis: updatedRedis,
    limiter,
    prefix,
    defaultJobOptions,
    settings: updatedSettings,
  });
};

module.exports = bullQueue;
