const AWS = require('aws-sdk');
const cfenv = require('cfenv');

const appEnv = cfenv.getAppEnv();
const awsCredentials = process.env.SQS_CREDS;

if (awsCredentials) {
  AWS.config.update({
    accessKeyId: awsCredentials.access_key,
    secretAccessKey: awsCredentials.secret_key,
    region: awsCredentials.region,
  });
}

module.exports = AWS;
