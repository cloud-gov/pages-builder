const crypto = require('crypto');
const nock = require('nock');

const randString = () => crypto.randomBytes(6).toString('hex');

const expandResource = (resource, idx) => {
  const guid = resource.guid || randString();
  const name = resource.name || `test-builder-${idx + 1}`;
  const state = resource.state || randString();

  return {
    metadata: {
      guid,
      url: `/v2/apps/${guid}`,
    },
    entity: {
      name,
      state,
    },
  };
};

const mockListAppsRequest = resources => nock('https://api.example.com', {
  reqheaders: {
    authorization: /Bearer .+/,
  },
}).get(
  '/v2/spaces/123abc-456def-789ghi/apps'
).reply(200, {
  resources: resources.map(expandResource),
});


module.exports = mockListAppsRequest;
