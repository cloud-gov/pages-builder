const { expect } = require('chai');
const nock = require('nock');

const CloudFoundryAPIClient = require('../src/cloud-foundry-api-client');

const mockListAppsRequest = require('./nocks/cloud-foundry-list-apps-by-label-nock');
const mockListAppStatsRequest = require('./nocks/cloud-foundry-list-app-stats-nock');
const mockRestageAppRequest = require('./nocks/cloud-foundry-restage-app-nock');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const mockUpdateAppRequest = require('./nocks/cloud-foundry-update-app-nock');
const mockV3ListAppsRequest = require('./nocks/cloud-foundry-v3-list-apps-nock');
const mockV3ListTasksRequest = require('./nocks/cloud-foundry-v3-list-tasks-nock');

describe('CloudFoundryAPIClient', () => {
  const buildContainerBaseName = 'test-builder';

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

  describe('.fetchBuildContainersByLabel()', () => {
    it('should resolve with an empty array if there are no apps', async () => {
      mockTokenRequest();
      mockListAppsRequest([]);

      const apiClient = new CloudFoundryAPIClient();
      const containers = await apiClient.fetchBuildContainersByLabel();

      expect(containers).to.deep.equal([]);
    });

    it('should resolve with appropriate schema', async () => {
      const app = {
        guid: 'guid',
        name: 'name',
        state: 'state',
        metadata: {
          labels: {
            type: 'type',
            name: 'name',
          },
          annotations: {
            command: 'command',
          },
        },
      };

      mockTokenRequest();
      mockListAppsRequest([app]);

      const apiClient = new CloudFoundryAPIClient();
      const containers = await apiClient.fetchBuildContainersByLabel();

      expect(containers[0]).to.deep.equal({
        guid: 'guid',
        name: 'name',
        state: 'state',
        containerName: app.metadata.labels.name,
        command: app.metadata.annotations.command,
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
    it('should resolve with the state of the build containers', async () => {
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
      const state = await apiClient.getBuildContainersState();

      expect(state).to.deep.equal({
        found: 2,
        started: 2,
      });
    });

    it('should resolve with an error if not all containers are started', async () => {
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
      const state = await apiClient.getBuildContainersState();

      expect(state).to.deep.equal({
        error: 'Not all build containers are in the STARTED state.',
      });
    });

    it("should resolve with an error if any started containers' instances are failing", async () => {
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
      const state = await apiClient.getBuildContainersState();

      expect(state).to.deep.equal({
        error: 'test-builder-2:\tNot all instances for are running. {"RUNNING":1,"CRASHED":1}',
      });
    });
  });

  it("should resolve with an error if any started containers' have no instances", async () => {
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
    const state = await apiClient.getBuildContainersState();

    expect(state).to.deep.equal({
      error: 'test-builder-2 has 0 running instances',
    });
  });

  describe('.fetchAppByName', () => {
    const appName = 'my-app';
    const app = { name: appName };

    beforeEach(() => {
      mockTokenRequest();
    });

    describe('when the app is found', () => {
      it('resolves with the app', async () => {
        mockV3ListAppsRequest(appName, [app]);

        const apiClient = new CloudFoundryAPIClient();
        const result = await apiClient.fetchAppByName(appName);

        expect(result.name).to.eq(appName);
      });
    });

    describe('when the app is NOT found', () => {
      it('resolves with undefined', async () => {
        const fakeAppName = 'foobar';
        mockV3ListAppsRequest(fakeAppName, [app]);

        const apiClient = new CloudFoundryAPIClient();
        const result = await apiClient.fetchAppByName(fakeAppName);

        expect(result).but.be.undefined;
      });
    });
  });

  describe('.fetchActiveTasks', () => {
    const activeTasks = [
      { name: 'pending', state: 'PENDING' },
      { name: 'running', state: 'RUNNING' },
      { name: 'canceling', state: 'CANCELING' },
    ];

    const inactiveTasks = [
      { name: 'failed', state: 'FAILED' },
    ];

    const allTasks = [
      ...activeTasks,
      ...inactiveTasks,
    ];

    beforeEach(() => {
      mockTokenRequest();
    });

    describe('when there are active tasks for the app', () => {
      it('resolves with only the active tasks', async () => {
        mockV3ListTasksRequest(allTasks);

        const apiClient = new CloudFoundryAPIClient();
        const result = await apiClient.fetchActiveTasks();
        expect(result).to.have.deep.members(activeTasks);
      });
    });

    describe('when there are NO active tasks for the app', () => {
      it('resolves with an empty array', async () => {
        mockV3ListTasksRequest(inactiveTasks);

        const apiClient = new CloudFoundryAPIClient();
        const result = await apiClient.fetchActiveTasks();

        expect(result).to.deep.eq([]);
      });
    });
  });

  describe('._filterAppsResponse', () => {
    const response = {
      resources: [
        {
          metadata: { guid: '', url: '' },
          entity: { name: `${buildContainerBaseName}`, state: '' },
        },
        {
          metadata: { guid: '', url: '' },
          entity: { name: `${buildContainerBaseName}-1`, state: '' },
        },
        {
          metadata: { guid: '', url: '' },
          entity: { name: `${buildContainerBaseName}-2`, state: '' },
        },
      ],
    };

    describe('when there is one build container', () => {
      const _numBuildContainers = 1;

      it('returns containers with the exact build container base name', () => {
        const apiClient = new CloudFoundryAPIClient();

        const result = apiClient._filterAppsResponse(
          buildContainerBaseName, _numBuildContainers, response
        );

        expect(result).to.deep.have.members([
          {
            guid: '', url: '', name: `${buildContainerBaseName}`, state: '',
          },
        ]);
      });
    });

    describe('when there are many build containers', () => {
      const _numBuildContainers = 3;

      it('returns containers with incremented build container base name', () => {
        const apiClient = new CloudFoundryAPIClient();

        const result = apiClient._filterAppsResponse(
          buildContainerBaseName, _numBuildContainers, response
        );

        expect(result).to.deep.have.members([
          {
            guid: '', url: '', name: `${buildContainerBaseName}-1`, state: '',
          },
          {
            guid: '', url: '', name: `${buildContainerBaseName}-2`, state: '',
          },
        ]);
      });
    });
  });
});
