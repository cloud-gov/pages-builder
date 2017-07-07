const jwt = require('jsonwebtoken');
const nock = require('nock');

const mockTokenRequest = (token) => {
  const accessToken = token || jwt.sign({ exp: (Date.now() / 1000) + 600 }, '123abc');

  return nock('https://login.example.com', {
    reqheaders: {
      authorization: `Basic ${Buffer('cf:').toString('Base64')}`,
    },
  }).post('/oauth/token', {
    grant_type: 'password',
    username: 'deploy_user',
    password: 'deploy_pass',
    response_type: 'token',
  }).reply(200, {
    access_token: accessToken,
  });
};

module.exports = mockTokenRequest;
