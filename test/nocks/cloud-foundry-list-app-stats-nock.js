const nock = require('nock');

const mockListAppStatsRequest = (guid, resources) => nock('https://api.example.com', {
  reqheaders: {
    authorization: /Bearer .+/,
  },
}).get(
    `/v2/apps/${guid}/stats`
  ).reply(200,
    resources
  );


module.exports = mockListAppStatsRequest;
