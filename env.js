const cfenv = require('cfenv');

const {
  CLOUD_FOUNDRY_OAUTH_TOKEN_URL,
  NODE_ENV,
} = process.env;

const vcapFile = NODE_ENV === 'test' ? './test/env.json' : '.env.json';
const appEnv = cfenv.getAppEnv({ vcapFile });

const { cf_api: cfApiHost, space_id: spaceId, space_name: spaceName } = appEnv.app;

const cfCreds = appEnv.getServiceCreds('federalist-deploy-user');
const sqsCreds = appEnv.getServiceCreds(`federalist-${spaceName}-sqs-creds`);

// Some helpful attributes
appEnv.cloudFoundryOAuthTokenUrl = CLOUD_FOUNDRY_OAUTH_TOKEN_URL;
appEnv.cloudFoundryCreds = {
  username: cfCreds.DEPLOY_USER_USERNAME || cfCreds.username,
  password: cfCreds.DEPLOY_USER_PASSWORD || cfCreds.password,
};
appEnv.cloudFoundryApiHost = cfApiHost;

appEnv.spaceGUID = spaceId;

appEnv.sqsCreds = sqsCreds;
appEnv.sqsUrl = sqsCreds.sqs_url;

module.exports = appEnv;
