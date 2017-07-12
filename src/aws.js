const AWS = require('aws-sdk');
const cfenv = require('cfenv');

const appEnv = cfenv.getAppEnv();
const awsCredentials = appEnv.getServiceCreds('federalist-ew-sqs-user');

if (awsCredentials) {
  AWS.config.update({
    accessKeyId: awsCredentials.access_key,
    secretAccessKey: awsCredentials.secret_key,
    region: 'us-east-1',
  });
}

module.exports = AWS;
