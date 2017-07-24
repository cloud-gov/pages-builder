const cfenv = require('cfenv');

const creds = cfenv.getAppEnv().getServiceCreds('federalist-builder-env');

/**
 * New Relic agent configuration.
 *
 * This file is require'd by the new relic lib, not directly by our code.
 *
 * See node_modules/lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME],
  license_key: creds.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
  },
};
