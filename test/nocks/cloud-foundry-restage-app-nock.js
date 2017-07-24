const crypto = require('crypto');
const nock = require('nock');

const mockRestageAppRequest = (guid, environment) => {
  const requestMock = nock('https://api.example.com', {
    reqheaders: {
      authorization: /Bearer .+/,
    },
  });

  if (guid && environment) {
    requestMock.post(
      `/v2/apps/${guid}/restage`
    ).reply(201, {
      metadata: {
        guid,
        url: `/v2/apps/${guid}`,
      },
      entity: {
        name: crypto.randomBytes(6).toString('hex'),
        docker_image: 'example.com:5000/builder/1',
        environment_json: environment,
      },
    });
  } else {
    requestMock.post(/v2\/apps\/.+\/restage/).reply(201);
  }

  return requestMock;
};

module.exports = mockRestageAppRequest;
