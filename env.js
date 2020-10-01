const cfenv = require('cfenv');

const {
  CLOUD_FOUNDRY_OAUTH_TOKEN_URL,
  NODE_ENV,
  TASK_DISK_GB,
  TASK_MAX_MEM_GB,
  TASK_MEM_GB,
  TASK_CUSTOM_MEM_GB,
  TASK_CUSTOM_DISK_GB,
  CUSTOM_TASK_MEM_REPOS,
} = process.env;

const vcapFile = NODE_ENV === 'test' ? './test/env.json' : '.env.json';
const appEnv = cfenv.getAppEnv({ vcapFile });

const { cf_api: cfApiHost, space_name: spaceName } = appEnv.app;

const cfCreds = appEnv.getServiceCreds('federalist-deploy-user');
const sqsCreds = appEnv.getServiceCreds(`federalist-${spaceName}-sqs-creds`);

// Some helpful attributes
appEnv.cloudFoundryOAuthTokenUrl = CLOUD_FOUNDRY_OAUTH_TOKEN_URL;
appEnv.cloudFoundryCreds = {
  username: cfCreds.DEPLOY_USER_USERNAME || cfCreds.username,
  password: cfCreds.DEPLOY_USER_PASSWORD || cfCreds.password,
};
appEnv.cloudFoundryApiHost = cfApiHost;

appEnv.sqsCreds = sqsCreds;
appEnv.sqsUrl = sqsCreds.sqs_url;

// Task Builder Pool
appEnv.taskDisk = TASK_DISK_GB && parseInt(TASK_DISK_GB, 10) * 1024;
appEnv.taskMemory = TASK_MEM_GB && parseInt(TASK_MEM_GB, 10) * 1024;
appEnv.maxTaskMemory = TASK_MAX_MEM_GB && parseInt(TASK_MAX_MEM_GB, 10) * 1024;
appEnv.customTaskMemRepos = JSON.parse(CUSTOM_TASK_MEM_REPOS || '[]');
appEnv.taskCustomMemory = TASK_CUSTOM_MEM_GB && parseInt(TASK_CUSTOM_MEM_GB, 10) * 1024;
appEnv.taskCustomDisk = TASK_CUSTOM_DISK_GB && parseInt(TASK_CUSTOM_DISK_GB, 10) * 1024;

module.exports = appEnv;
