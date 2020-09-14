const crypto = require('crypto');
const nock = require('nock');

const randString = () => crypto.randomBytes(6).toString('hex');

const expandResource = (resource, idx) => {
  const guid = resource.guid || randString();
  const name = resource.name || `test-builder-${idx + 1}`;
  const state = resource.state || randString();

  return {
    guid,
    name,
    state,
  };
};

const mockV3ListAppsRequest = (appName, resources) => nock('https://api.example.com', {
  reqheaders: {
    authorization: /Bearer .+/,
  },
}).get(
  `/v3/apps?names=${appName}`
).reply(200, {
  resources: resources
    .map(expandResource)
    .filter(resource => resource.name === appName),
});

module.exports = mockV3ListAppsRequest;
