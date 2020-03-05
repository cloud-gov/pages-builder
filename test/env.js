// Cloud Foundry Auth
process.env.CLOUD_FOUNDRY_OAUTH_TOKEN_URL = 'https://login.example.com/oauth/token';

// Docker
process.env.BUILD_CONTAINER_DOCKER_IMAGE_NAME = 'example.com:5000/builder/1';
process.env.EXPECTED_NUM_BUILD_CONTAINERS = '2';

// Server
process.env.PORT = 3000;

// Logging
process.env.LOG_LEVEL = 'crit';
