const nock = require('nock');

const expandResource = (resource, idx) => {
  const name = resource.name || `test-builder-${idx + 1}`;
  const state = resource.state || 'PROCESSING';

  return {
    name,
    state,
  };
};

const mockV3ListTasksRequest = (appGUID, resources) => nock('https://api.example.com', {
  reqheaders: {
    authorization: /Bearer .+/,
  },
}).get(
  `/v3/apps/${appGUID}/tasks?states=PENDING,RUNNING,CANCELING`
).reply(200, {
  resources: resources
    .map(expandResource)
    .filter(resource => ['PENDING', 'RUNNING', 'CANCELING'].includes(resource.state)),
});

module.exports = mockV3ListTasksRequest;
