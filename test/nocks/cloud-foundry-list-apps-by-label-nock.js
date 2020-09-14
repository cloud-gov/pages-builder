const crypto = require('crypto');
const nock = require('nock');

const randString = () => crypto.randomBytes(6).toString('hex');

const expandResource = (resource, idx) => {
  const guid = resource.guid || randString();
  const name = resource.name || `test-builder-${idx + 1}`;
  const state = resource.state || randString();
  const metadata = resource.metadata || { labels: {}, annotations: {} };

  return {
    guid,
    name,
    state,
    url: `/v3/apps/${guid}`,
    metadata,
  };
};

const mockListAppsRequest = resources => nock('https://api.example.com', {
  reqheaders: {
    authorization: /Bearer .+/,
  },
}).get(
  '/v3/apps/?label_selector=type==build-container'
).reply(200, {
  resources: resources.map(expandResource),
});

module.exports = mockListAppsRequest;
