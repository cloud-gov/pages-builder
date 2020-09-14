const nock = require('nock');

const expandResource = (resource, idx) => {
  const name = resource.name || `test-builder-${idx + 1}`;
  const state = resource.state || 'PROCESSING';

  return {
    name,
    state,
  };
};

const mockV3ListTasksRequest = resources => nock('https://api.example.com', {
  reqheaders: {
    authorization: /Bearer .+/,
  },
}).get(
  '/v3/tasks?states=PENDING,RUNNING,CANCELING&label_selector=type==build-task'
).reply(200, {
  resources: resources
    .map(expandResource)
    .filter(resource => ['PENDING', 'RUNNING', 'CANCELING'].includes(resource.state)),
});

module.exports = mockV3ListTasksRequest;
