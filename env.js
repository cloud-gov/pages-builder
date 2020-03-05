const cfenv = require('cfenv');

const {
  CLOUD_FOUNDRY_OAUTH_TOKEN_URL,
  NEW_RELIC_APP_NAME,
  NODE_ENV,
} = process.env;

const vcapFile = NODE_ENV === 'test' ? './test/env.json' : '.env.json';
const appEnv = cfenv.getAppEnv({ vcapFile });

const { cf_api: cfApiHost, space_id: spaceId, space_name: spaceName } = appEnv.app;

const cfCreds = appEnv.getServiceCreds('federalist-deploy-user');
const apmCreds = appEnv.getServiceCreds('federalist-builder-env');
const sqsCreds = appEnv.getServiceCreds(`federalist-${spaceName}-sqs-creds`);

// Some helpful attributes
appEnv.cloudFoundryOAuthTokenUrl = CLOUD_FOUNDRY_OAUTH_TOKEN_URL;
appEnv.cloudFoundryCreds = {
  username: cfCreds.DEPLOY_USER_USERNAME,
  password: cfCreds.DEPLOY_USER_PASSWORD,
};
appEnv.cloudFoundryApiHost = cfApiHost;

appEnv.isAPMConfigured = NEW_RELIC_APP_NAME && apmCreds && apmCreds.NEW_RELIC_LICENSE_KEY;
appEnv.newRelicConfig = appEnv.isAPMConfigured && {
  app_name: [NEW_RELIC_APP_NAME],
  license_key: apmCreds.NEW_RELIC_LICENSE_KEY,
};

appEnv.spaceGUID = spaceId;

appEnv.sqsCreds = sqsCreds;
appEnv.sqsUrl = sqsCreds.sqs_url;

module.exports = appEnv;
