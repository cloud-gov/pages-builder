const cfenv = require('cfenv');

const {
  APP_ENV,
  CLOUD_FOUNDRY_OAUTH_TOKEN_URL,
  DEPLOY_USER_USERNAME,
  DEPLOY_USER_PASSWORD,
  NEW_RELIC_APP_NAME,
} = process.env;

const appEnv = cfenv.getAppEnv({
  protocol: 'http:',
  vcapFile: '.env.json',
});

const cfCreds = appEnv.getServiceCreds('federalist-deploy-user');
const apmCreds = appEnv.getServiceCreds('federalist-builder-env');
const sqsCreds = appEnv.getServiceCreds(`federalist-${APP_ENV}-sqs-creds`);

// Some helpful attributes/methods
appEnv.cloudFoundryOAuthTokenUrl = CLOUD_FOUNDRY_OAUTH_TOKEN_URL;
appEnv.cloudFoundryCreds = {
  username: cfCreds.DEPLOY_USER_USERNAME || DEPLOY_USER_USERNAME,
  password: cfCreds.DEPLOY_USER_PASSWORD || DEPLOY_USER_PASSWORD,
};
appEnv.isAPMConfigured = NEW_RELIC_APP_NAME && apmCreds && apmCreds.NEW_RELIC_LICENSE_KEY;
appEnv.newRelicConfig = appEnv.isAPMConfigured && {
  app_name: [NEW_RELIC_APP_NAME],
  license_key: apmCreds.NEW_RELIC_LICENSE_KEY,
};

appEnv.sqsCreds = sqsCreds;
appEnv.sqsUrl = appEnv.awsCreds.sqs_url;

module.exports = appEnv;
