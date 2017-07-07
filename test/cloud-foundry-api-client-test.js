const expect = require('chai').expect;
const nock = require('nock');

const CloudFoundryAPIClient = require('../src/cloud-foundry-api-client');

const mockListAppsRequest = require('./nocks/cloud-foundry-list-apps-nock');
const mockRestageAppRequest = require('./nocks/cloud-foundry-restage-app-nock');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const mockUpdateAppRequest = require('./nocks/cloud-foundry-update-app-nock');


describe('CloudFoundryAPIClient', () => {
  afterEach(() => nock.cleanAll());

  describe('.fetchBuildContainers()', () => {
    it('should resolve with an empty array if there are no apps', (done) => {
      mockTokenRequest();
      mockListAppsRequest([]);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchBuildContainers().then((containers) => {
        expect(containers).to.deep.equal([]);
        done();
      });
    });

    it('should resolve with an empty array if there are no containers running the build image', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        { dockerImage: null },
        { dockerImage: 'library/registry:2' },
      ]);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchBuildContainers().then((containers) => {
        expect(containers).to.deep.equal([]);
        done();
      });
    });

    it('should resolve with filtered containers running the build image', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        { dockerImage: null },
        { dockerImage: 'library/registry:2' },
        {
          guid: '123abc',
          name: 'builder-1',
          dockerImage: 'example.com:5000/builder/1',
        },
      ]);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchBuildContainers().then((containers) => {
        expect(containers).to.have.length(1);
        expect(containers).to.deep.equal([{
          guid: '123abc',
          url: '/v2/apps/123abc',
          name: 'builder-1',
          dockerImage: 'example.com:5000/builder/1',
        }]);
        done();
      });
    });
  });

  describe('.updateBuildContainer(guid, environment)', () => {
    it('should update the app environment and restage the app', (done) => {
      const guid = 'asdf-hjkl';
      const container = { url: `/v2/apps/${guid}` };
      const environment = {
        OVERRIDE_A: 'Value A',
        OVERRIDE_B: 'Value B',
      };

      mockTokenRequest();
      mockUpdateAppRequest(guid, environment);
      mockRestageAppRequest(guid, environment);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.updateBuildContainer(container, environment).then((response) => {
        const parsedResponse = JSON.parse(response);
        expect(parsedResponse.entity.environment_json).to.deep.equal(environment);
        done();
      });
    });
  });
});
