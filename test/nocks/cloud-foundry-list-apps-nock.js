const crypto = require('crypto');
const nock = require('nock');

const randString = () => crypto.randomBytes(6).toString('hex');

const expandResource = (resource) => {
  const guid = resource.guid || randString();
  const name = resource.name || randString();
  const state = resource.state || randString();

  let dockerImage;
  if (Object.keys(resource).indexOf('dockerImage') >= 0) {
    dockerImage = resource.dockerImage;
  } else {
    dockerImage = 'example.com:5000/builder/1';
  }

  return {
    metadata: {
      guid,
      url: `/v2/apps/${guid}`,
    },
    entity: {
      name,
      state,
      docker_image: dockerImage,
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
