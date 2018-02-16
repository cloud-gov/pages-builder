const AWS = require('aws-sdk-mock');
const AWS_SDK = require('aws-sdk');

AWS.setSDKInstance(AWS_SDK);

module.exports = {
  mock(service, method, data, error = null) {
    AWS.mock(service, method, (params, callback) => {
      callback(error, data);
    });

    return () => {
      AWS.restore(service, method);
    };
  },
};
