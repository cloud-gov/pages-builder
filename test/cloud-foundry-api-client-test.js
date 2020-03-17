const { expect } = require('chai');
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
      const response = {
        0: { state: 'RUNNING' },
        1: { state: 'RUNNING' },
        2: { state: 'FLAPPING' },
      };
      mockTokenRequest();
      mockListAppStatsRequest(guid, response);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchAppStats(guid)
        .then((appInstances) => {
          expect(appInstances).to.deep.equal(response);
          return apiClient._appInstanceStates(appInstances);
        })
        .then((statesCount) => {
          expect(statesCount.RUNNING).to.deep.equal(2);
          expect(statesCount.FLAPPING).to.deep.equal(1);
          done();
        })
        .catch(done);
    });
  });

  describe('.fetchBuildContainers()', () => {
    it('should resolve with an empty array if there are no apps', (done) => {
      mockTokenRequest();
      mockListAppsRequest([]);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchBuildContainers()
        .then((containers) => {
          expect(containers).to.deep.equal([]);
          done();
        });
    });

    it('should resolve with an empty array if there are no containers with the expected name', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        { name: 'foo-builder-1' },
        { name: 'boo-builder-2' },
      ]);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchBuildContainers()
        .then((containers) => {
          expect(containers).to.deep.equal([]);
          done();
        });
    });

    it('should resolve with filtered containers with the expected names', (done) => {
      const container1 = {
        guid: '123abc',
        name: 'test-builder-1',
        state: 'STATE',
        url: '/v2/apps/123abc',
      };

      const container2 = {
        guid: '456def',
        name: 'test-builder-2',
        state: 'STATE',
        url: '/v2/apps/456def',
      };

      mockTokenRequest();
      mockListAppsRequest([
        container1,
        container2,
        { name: 'test-builder-3' },
      ]);

      const apiClient = new CloudFoundryAPIClient();
      apiClient.fetchBuildContainers()
        .then((containers) => {
          expect(containers).to.have.length(2);
          expect(containers).to.deep.equal([container1, container2]);
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
      apiClient.updateBuildContainer(container, environment)
        .then((response) => {
          expect(response.entity.environment_json).to.deep.equal(environment);
          done();
        });
    });
  });

  describe('.getBuildContainersState()', () => {
    // these tests rely on the NUM_BUILD_CONTAINERS env var
    // that is set in ./test/env.js
    it('should resolve with the state of the build containers', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'test-builder-1',
          state: 'STARTED',
        },
        {
          guid: '456def',
          name: 'test-builder-2',
          state: 'STARTED',
        },
      ]);

      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });
      mockListAppStatsRequest('456def', { 0: { state: 'RUNNING' } });

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState()
        .then((state) => {
          expect(state).to.deep.equal({
            expected: 2,
            found: 2,
            started: 2,
          });
          done();
        })
        .catch(done);
    });

    it('should resolve with an error if there are too few build containers', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'test-builder-1',
          state: 'STARTED',
        },
      ]);
      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState()
        .then((state) => {
          expect(state).to.deep.equal({
            error: [
              'Expected 2 build containers but only 1 found.',
              'Not all build containers are in the STARTED state.',
            ].join('\n'),
          });
          done();
        })
        .catch(done);
    });

    it('should resolve with an error if not all containers are started', (done) => {
      mockTokenRequest();
      mockListAppsRequest([
        {
          guid: '123abc',
          name: 'test-builder-1',
          state: 'STOPPED',
        },
        {
          guid: '456def',
          name: 'test-builder-2',
          state: 'STARTED',
        },
      ]);

      mockListAppStatsRequest('456def', { 0: { state: 'RUNNING' } });

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState()
        .then((state) => {
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
          name: 'test-builder-1',
          state: 'STARTED',
        },
        {
          guid: '456def',
          name: 'test-builder-2',
          state: 'STARTED',
        },
      ]);

      mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });

      mockListAppStatsRequest('456def', {
        1: { state: 'CRASHED' },
        0: { state: 'RUNNING' },
      });

      const apiClient = new CloudFoundryAPIClient();
      apiClient.getBuildContainersState()
        .then((state) => {
          expect(state).to.deep.equal({
            error: 'test-builder-2:\tNot all instances for are running. {"RUNNING":1,"CRASHED":1}',
          });
          done();
        });
    });
  });

  it("should resolve with an error if any started containers' have no instances", (done) => {
    mockTokenRequest();
    mockListAppsRequest([
      {
        guid: '123abc',
        name: 'test-builder-1',
        state: 'STARTED',
      },
      {
        guid: '456def',
        name: 'test-builder-2',
        state: 'STARTED',
      },
    ]);

    mockListAppStatsRequest('123abc', { 0: { state: 'RUNNING' } });

    mockListAppStatsRequest('456def', {});

    const apiClient = new CloudFoundryAPIClient();
    apiClient.getBuildContainersState()
      .then((state) => {
        expect(state).to.deep.equal({
          error: 'test-builder-2 has 0 running instances',
        });
        done();
      })
      .catch(done);
  });
});
