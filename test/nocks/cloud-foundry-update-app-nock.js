const crypto = require('crypto');
const nock = require('nock');

const mockUpdateAppRequest = (guid, environment) => {
  const requestMock = nock('https://api.example.com', {
    reqheaders: {
      authorization: /Bearer .+/,
    },
  });

  if (guid && environment) {
    requestMock.put(`/v2/apps/${guid}`, {
      environment_json: environment,
    }).reply(201, {
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
    requestMock.put(/v2\/apps\/.+/).reply(201);
  }

  return requestMock;
};

module.exports = mockUpdateAppRequest;
