const expect = require('chai').expect;
const nock = require('nock');

const CloudFoundryAPIClient = require('../src/cloud-foundry-api-client');

const mockListAppsRequest = require('./nocks/cloud-foundry-list-apps-nock');
const mockListAppStatsRequest = require('./nocks/cloud-foundry-list-app-stats-nock');
const mockRestageAppRequest = require('./nocks/cloud-foundry-restage-app-nock');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const mockUpdateAppRequest = require('./nocks/cloud-foundry-update-app-nock');


describe('CloudFoundryAPIClient', () => {
  afterEach(() => nock.cleanAll());

  describe('.fetchAppStats()', () => {
    it('should return the instances for an app', (done) => {
      const guid = 'test-guid';
      response = {
          '0': { state: "RUNNING" },
          '1': { state: "RUNNING" },
          '2': { state: "FLAPPING" },
        };
      mockTokenRequest();
      mockListAppStatsRequest(guid, response);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchAppStats(guid).then((appInstances) => {
        expect(appInstances).to.deep.equal(JSON.stringify(response));
        return apiClient._appInstanceStatesCount(JSON.parse(appInstances));
      }).then(statesCount => {
        expect(statesCount["RUNNING"]).to.deep.equal(2);
        expect(statesCount["FLAPPING"]).to.deep.equal(1);
        done();
      });
    });
  });

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
          state: 'STATE',
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
          state: 'STATE',
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

  describe('.getBuildContainersState()', () => {
    // these tests rely on the EXPECTED_NUM_BUILD_CONTAINERS env var
    // that is set in ./test/env.js
    it('should resolve with the state of the build containers', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'builder-1',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
        {
          guid: '456def',
          name: 'builder-2',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
      ]);

      mockListAppStatsRequest('123abc', { 0: { state: "RUNNING" }});
      mockListAppStatsRequest('456def', { 0: { state: "RUNNING" }});

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState().then((state) => {
        expect(state).to.deep.equal({
          expected: 2,
          found: 2,
          started: 2,
        });
        done();
      }).catch(done);
    });

    it('should resolve with an error if there are too few build containers', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'builder-1',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
      ]);
      mockListAppStatsRequest('123abc', { 0: { state: "RUNNING" }});

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState().then((state) => {
        expect(state).to.deep.equal({
          error: 'Expected 2 build containers but only 1 found.',
        });
        done();
      });
    });

    it('should resolve with an error if not all containers are started', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'builder-1',
          state: 'STOPPED',
          dockerImage: 'example.com:5000/builder/1',
        },
        {
          guid: '456def',
          name: 'builder-2',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
      ]);

      mockListAppStatsRequest('456def', { 0: { state: "RUNNING" }});

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState().then((state) => {
        expect(state).to.deep.equal({
          error: 'Not all build containers are in the STARTED state.',
        });
        done();
      });
    });

    it("should resolve with an error if any started containers' instances are failing", (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'builder-1',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
        {
          guid: '456def',
          name: 'builder-2',
          state: 'STARTED',
          dockerImage: 'example.com:5000/builder/1',
        },
      ]);

      mockListAppStatsRequest('123abc', { '0': { state: "RUNNING", }, });

      mockListAppStatsRequest('456def', {
        '1': { state: "CRASHED", },
        '0': { state: "RUNNING", }, 
      });

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState().then((state) => {
        expect(state).to.deep.equal({
          error: "builder-2:\tNot all instances for are running. {\"RUNNING\":1,\"CRASHED\":1}",
        });
        done();
      })
    });
  });

  it("should resolve with an error if any started containers' have no instances", (done) => {
    mockTokenRequest();
    mockListAppsRequest([
      {
        guid: '123abc',
        name: 'builder-1',
        state: 'STARTED',
        dockerImage: 'example.com:5000/builder/1',
      },
      {
        guid: '456def',
        name: 'builder-2',
        state: 'STARTED',
        dockerImage: 'example.com:5000/builder/1',
      },
    ]);

    mockListAppStatsRequest('123abc', { '0': { state: "RUNNING", }, });

    mockListAppStatsRequest('456def', {});

    const apiClient = new CloudFoundryAPIClient();
    apiClient.getBuildContainersState().then((state) => {
      expect(state).to.deep.equal({
        error: "builder-2 has 0 running instances",
      });
      done();
    })
  });
});
