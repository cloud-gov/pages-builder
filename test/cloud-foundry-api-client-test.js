const { expect } = require('chai');
const nock = require('nock');

const CloudFoundryAPIClient = require('../src/cloud-foundry-api-client');

const mockListAppsRequest = require('./nocks/cloud-foundry-list-apps-by-label-nock');
const mockListAppStatsRequest = require('./nocks/cloud-foundry-list-app-stats-nock');
const mockTokenRequest = require('./nocks/cloud-foundry-oauth-token-nock');
const mockV3ListTasksRequest = require('./nocks/cloud-foundry-v3-list-tasks-nock');

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
});
