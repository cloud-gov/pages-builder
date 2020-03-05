const { newRelicConfig } = require('./env');
const logger = require('./src/logger');

/**
 * New Relic agent configuration.
 *
 * This file is required by the new relic lib, not directly by our code.
 *
 * See node_modules/lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
logger.info(`Activating New Relic: ${newRelicConfig.app_name}`);

exports.config = {
  ...newRelicConfig,
  logging: {
    level: 'info',
  },
};
