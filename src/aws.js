const AWS = require('aws-sdk');
const appEnv = require('../env');

const awsCredentials = appEnv.getServiceCreds(`federalist-${process.env.APP_ENV}-sqs-creds`);

if (awsCredentials) {
  AWS.config.update({
    accessKeyId: awsCredentials.access_key,
    secretAccessKey: awsCredentials.secret_key,
    region: awsCredentials.region,
  });
}

module.exports = AWS;
