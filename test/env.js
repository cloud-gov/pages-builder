// AWS Services
process.env.SQS_URL = 'https://sqs.us-east-1.amazonaws.com/123abc/456def';

// Cloud Foundry API
process.env.CLOUD_FOUNDRY_API_HOST = 'https://api.example.com';
process.env.BUILD_SPACE_GUID = '123abc-456def-789ghi';

// Cloud Foundry Auth
process.env.CLOUD_FOUNDRY_OAUTH_TOKEN_URL = 'https://login.example.com/oauth/token';
process.env.DEPLOY_USER_USERNAME = 'deploy_user';
process.env.DEPLOY_USER_PASSWORD = 'deploy_pass';
process.env.SERVICE_KEY_CREATED = new Date(new Date() - (1 * 24 * 60 * 60 * 1000));

// Docker
process.env.BUILD_CONTAINER_DOCKER_IMAGE_NAME = 'example.com:5000/builder/1';
process.env.EXPECTED_NUM_BUILD_CONTAINERS = '2';

// Server
process.env.PORT = 3000;
process.env.BUILD_COMPLETE_CALLBACK_HOST = 'https://example.com';

// Logging
process.env.LOG_LEVEL = 'crit';
