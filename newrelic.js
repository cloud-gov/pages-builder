const logger = require('./src/logger');

/**
 * New Relic agent configuration.
 *
 * This file is required by the new relic lib, not directly by our code.
 *
 * See node_modules/lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */

const { NEW_RELIC_APP_NAME, NEW_RELIC_LICENSE_KEY } = process.env;

logger.info(`Activating New Relic: ${NEW_RELIC_APP_NAME}`);

exports.config = {
  app_name: [NEW_RELIC_APP_NAME],
  license_key: NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
  },
};
