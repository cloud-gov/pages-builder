const crypto = require('crypto');
const nock = require('nock');

const expandResource = (resource) => {
  const guid = resource.guid || crypto.randomBytes(6).toString('hex');
  const name = resource.name || crypto.randomBytes(6).toString('hex');

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
