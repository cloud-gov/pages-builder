const { expect } = require('chai');
const sinon = require('sinon');

const CFTaskPool = require('../src/cf-task-pool');

const defaults = {
  maxTaskMemory: 30 * 1024,
  taskDisk: 4 * 1024,
  taskMemory: 2 * 1024,
  url: 'http://example.com',
  taskCustomDisk: 6 * 1024,
  taskCustomMemory: 8 * 1024,
};

function createPool(params = {}) {
  const args = {
    ...defaults,
    ...params,
  };

  return new CFTaskPool(args);
}

describe('CFTaskPool', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('.canStartBuild', () => {
    it('returns a promise that resolves to the value of calling _hasAvailableMemory()', async () => {
      const foobar = true;
      const builderPool = createPool();
      const build = {};

      sinon
        .stub(builderPool, '_hasAvailableMemory')
        .resolves(foobar);

      const result = await builderPool.canStartBuild(build);

      sinon.assert.calledOnceWithExactly(builderPool._hasAvailableMemory, builderPool._taskMemory);
      expect(result).to.eq(foobar);
    });
  });

  describe('.startBuild', () => {
    const task = {
      name: 'task',
      guid: 'def987',
    };
    const build = {
      buildID: 1,
      containerEnvironment: {},
    };

    let builderPool;
    let getBuildTask;

    beforeEach(() => {
      builderPool = createPool();

      const buildTaskSpy = sinon.spy(builderPool, '_buildTask');
      sinon.spy(builderPool._buildStatusReporter, 'reportBuildStatus');

      getBuildTask = () => buildTaskSpy.getCall(0).returnValue;
    });

    describe('when no build containers are found', () => {
      it('rejects with a `TaskStartError`', async () => {
        sinon.stub(builderPool._apiClient, 'fetchBuildContainersByLabel').resolves([]);

        const result = await builderPool.startBuild({}).catch(error => error);

        expect(result).to.be.a('Error');
        expect(result.message).to.equal('No build containers exist in this space.');
      });
    });

    describe('when no build containers for the specified name are found', () => {
      it('rejects with a `TaskStartError`', async () => {
        sinon.stub(builderPool._apiClient, 'fetchBuildContainersByLabel').resolves([{}]);

        const result = await builderPool.startBuild({}).catch(error => error);

        expect(result).to.be.a('Error');
        expect(result.message).to.equal('Could not find build container with name: "default"');
      });
    });

    describe('when starting the task fails', () => {
      it('rejects with a TaskStartError', async () => {
        const container = {
          containerName: 'default',
          guid: 'abc123',
        };

        sinon.stub(builderPool._apiClient, 'fetchBuildContainersByLabel').resolves([container]);
        sinon.stub(builderPool._apiClient, 'startTaskForApp').rejects(new Error('uh oh'));

        const result = await builderPool.startBuild(build).catch(error => error);

        sinon.assert.calledWith(builderPool._buildTask, build);
        sinon.assert.calledWith(
          builderPool._apiClient.startTaskForApp,
          getBuildTask(),
          container.guid
        );
        sinon.assert.notCalled(builderPool._buildStatusReporter.reportBuildStatus);
        expect(result).be.a('error');
        expect(result.message).to.eq('uh oh');
      });
    });

    describe('when successful', () => {
      it('starts the task in CF', async () => {
        const container = {
          containerName: 'default',
          guid: 'abc123',
        };

        sinon.stub(builderPool._apiClient, 'fetchBuildContainersByLabel').resolves([container]);
        sinon.stub(builderPool._apiClient, 'startTaskForApp').resolves(task);

        await builderPool.startBuild(build);

        sinon.assert.calledWith(builderPool._buildTask, build);
        sinon.assert.calledWith(
          builderPool._apiClient.startTaskForApp,
          getBuildTask(),
          container.guid
        );
      });
    });
  });

  describe('._buildTask', () => {
    it('returns an object containing name, memory, disk, and command for task', () => {
      const expectedKeys = ['name', 'disk_in_mb', 'memory_in_mb', 'command'];
      const buildId = 1234;
      const command = 'command';

      const build = {
        containerEnvironment: {
          BUILD_ID: buildId,
        },
      };

      const builderPool = createPool();
      const result = builderPool._buildTask(build, command);

      expect(result).to.be.an('object');
      expectedKeys.forEach(key => expect(result[key]).to.exist);
      expect(result.name).to.include(buildId);
      expect(result.command).to.eq(`${command} '${JSON.stringify(build.containerEnvironment)}'`);
      expect(result.memory_in_mb).to.eq(builderPool._taskMemory);
      expect(result.disk_in_mb).to.eq(builderPool._taskDisk);
    });
  });

  describe('._hasAvailableMemory', () => {
    const taskMemory = 2 * 1024;
    const maxTaskMemory = 5 * 1024;

    describe('when there is not enough memory', () => {
      it('returns false', async () => {
        const builderPool = createPool({ taskMemory, maxTaskMemory });
        sinon.stub(builderPool._apiClient, 'fetchActiveTasks')
          .resolves([
            { memory_in_mb: taskMemory },
            { memory_in_mb: taskMemory },
          ]);

        const hasAvailableMemory = await builderPool._hasAvailableMemory(taskMemory);
        expect(hasAvailableMemory).to.be.false;
      });
    });

    describe('when there is enough memory', () => {
      it('returns true ', async () => {
        const builderPool = createPool({ taskMemory, maxTaskMemory });
        sinon.stub(builderPool._apiClient, 'fetchActiveTasks')
          .resolves([{ memory_in_mb: taskMemory }]);

        const hasAvailableMemory = await builderPool._hasAvailableMemory(taskMemory);
        expect(hasAvailableMemory).to.be.true;
      });
    });
  });
});
