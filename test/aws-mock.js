const AWS = require('aws-sdk-mock');

module.exports = {
  mock(service, method, data, error = null) {
    AWS.mock(service, method, (params, callback) => {
      callback(error, data);
    });

    return () => {
      AWS.restore(service, method);
    };
  }
};
