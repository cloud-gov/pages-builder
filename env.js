const cfenv = require('cfenv');

const {
  BUILDER_POOL_TYPE,
  BUILD_CONTAINER_BASE_NAME,
  BUILD_TIMEOUT_SECONDS,
  CLOUD_FOUNDRY_OAUTH_TOKEN_URL,
  NODE_ENV,
  NUM_BUILD_CONTAINERS,
  TASK_APP_NAME,
  TASK_APP_COMMAND,
  TASK_DISK_GB,
  TASK_MAX_MEM_GB,
  TASK_MEM_GB,
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

// Builder Pools
appEnv.builderPoolType = BUILDER_POOL_TYPE;
appEnv.buildTimeout = 1000 * (parseInt(BUILD_TIMEOUT_SECONDS, 10) || 21 * 60); // milliseconds

// Application Builder Pool
appEnv.buildContainerBaseName = BUILD_CONTAINER_BASE_NAME;
appEnv.numBuildContainers = parseInt(NUM_BUILD_CONTAINERS, 10);

// Task Builder Pool
appEnv.taskAppName = TASK_APP_NAME;
appEnv.taskAppCommand = TASK_APP_COMMAND;
appEnv.taskDisk = TASK_DISK_GB && parseInt(TASK_DISK_GB, 10) * 1024;
appEnv.taskMemory = TASK_MEM_GB && parseInt(TASK_MEM_GB, 10) * 1024;
appEnv.maxTaskMemory = TASK_MAX_MEM_GB && parseInt(TASK_MAX_MEM_GB, 10) * 1024;

module.exports = appEnv;
