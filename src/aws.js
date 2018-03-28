const AWS = require('aws-sdk');
const cfenv = require('cfenv');

const appEnv = cfenv.getAppEnv();
const awsCredentials = appEnv.getServiceCreds('federalist-staging-sqs-creds');

if (awsCredentials) {
  AWS.config.update({
    accessKeyId: awsCredentials.access_key,
    secretAccessKey: awsCredentials.secret_key,
    region: awsCredentials.region,
  });
}

module.exports = AWS;
