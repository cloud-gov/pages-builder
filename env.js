const cfenv = require('cfenv');

const appEnv = cfenv.getAppEnv({
  protocol: 'http:',
  vcapFile: '.env.json',
});

module.exports = appEnv;
