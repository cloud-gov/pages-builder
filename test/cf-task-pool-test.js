const { expect } = require('chai');
const sinon = require('sinon');

const CFTaskPool = require('../src/cf-task-pool');

const defaults = {
  buildTimeout: 1000,
  maxTaskMemory: 30 * 1024,
  taskDisk: 4 * 1024,
  taskMemory: 2 * 1024,
  url: 'http://example.com',
  customTaskMemRepos: [],
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

      sinon
        .stub(builderPool, '_requiresCustom')
        .returns(false);

      const result = await builderPool.canStartBuild(build);

      sinon.assert.calledOnceWithExactly(builderPool._requiresCustom, build);
      sinon.assert.calledOnceWithExactly(builderPool._hasAvailableMemory, builderPool._taskMemory);
      expect(result).to.eq(foobar);
    });
  });

  describe('.startBuild', () => {
    const timeOutHandle = 1;
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
      sinon.stub(builderPool, '_createBuildTimeout').returns(timeOutHandle);

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
          builderPool._apiClient.startTaskForApp, getBuildTask(), container.guid
        );

        expect(result).be.a('error');
        expect(result.message).to.eq('uh oh');
        expect(builderPool._builds[build.buildID]).to.be.undefined;
      });
    });

    describe('when successful', () => {
      it('starts the task in CF and adds the build GUID and timeout to an in-memory cache', async () => {
        const container = {
          containerName: 'default',
          guid: 'abc123',
        };

        sinon.stub(builderPool._apiClient, 'fetchBuildContainersByLabel').resolves([container]);
        sinon.stub(builderPool._apiClient, 'startTaskForApp').resolves(task);

        expect(builderPool._builds[build.buildID]).to.be.undefined;

        await builderPool.startBuild(build);

        sinon.assert.calledWith(builderPool._buildTask, build);
        sinon.assert.calledWith(
          builderPool._apiClient.startTaskForApp, getBuildTask(), container.guid
        );

        expect(builderPool._builds[build.buildID]).to.deep.equal({
          taskGUID: 'def987',
          timeout: timeOutHandle,
        });
      });
    });
  });

  describe('.stop', () => {
    it('does nothing and returns true', () => {
      const builderPool = createPool();
      expect(builderPool.stop()).to.be.true;
    });
  });

  describe('.stopBuild', () => {
    const buildID = 123;
    const taskGUID = 'abc123';
    const timeout = 1;
    const build = { taskGUID, timeout };

    let builderPool;

    beforeEach(() => {
      sinon.useFakeTimers();

      builderPool = createPool();
      builderPool._builds[buildID] = build;

      sinon.spy(sinon.clock, 'clearTimeout');
    });

    it('removes the build, clears the timeout and stops the task', async () => {
      sinon.stub(builderPool._apiClient, 'stopTask').resolves();

      await builderPool.stopBuild(buildID);

      expect(builderPool._builds[buildID]).to.be.undefined;
      sinon.assert.calledWith(sinon.clock.clearTimeout, timeout);
      sinon.assert.calledWith(builderPool._apiClient.stopTask, taskGUID);
    });

    it('ignores rejections from CF Api', async () => {
      sinon.stub(builderPool._apiClient, 'stopTask').rejects();

      await builderPool.stopBuild(buildID);

      expect(builderPool._builds[buildID]).to.be.undefined;
      sinon.assert.calledWith(sinon.clock.clearTimeout, timeout);
      sinon.assert.calledWith(builderPool._apiClient.stopTask, taskGUID);
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
      expect(result.command).to.eq(`${command} ${JSON.stringify(build.containerEnvironment)}`);
      expect(result.memory_in_mb).to.eq(builderPool._taskMemory);
      expect(result.disk_in_mb).to.eq(builderPool._taskDisk);
    });

    describe('when build requires custom resources', () => {
      it('returns the custom memory', () => {
        const expectedKeys = ['name', 'disk_in_mb', 'memory_in_mb', 'command'];
        const buildId = 1234;
        const command = 'command';

        const build = {
          containerEnvironment: {
            BUILD_ID: buildId,
            OWNER: 'owner',
            REPOSITORY: 'REPO', // Checking case insensitivity as well
          },
        };
        const builderPool = createPool({ customTaskMemRepos: ['owner/repo'] });
        const result = builderPool._buildTask(build, command);

        expect(result).to.be.an('object');
        expectedKeys.forEach(key => expect(result[key]).to.exist);
        expect(result.name).to.include(buildId);
        expect(result.command).to.eq(`${command} ${JSON.stringify(build.containerEnvironment)}`);
        expect(result.memory_in_mb).to.eq(builderPool._taskCustomMemory);
        expect(result.disk_in_mb).to.eq(builderPool._taskCustomDisk);
      });
    });
  });

  describe('._createBuildTimeout', () => {
    it('times the build after `buildTimeout` mills', () => {
      const clock = sinon.useFakeTimers();

      const buildTimeout = 1000;
      const build = {};
      const builderPool = createPool({ buildTimeout });
      sinon.stub(builderPool, '_timeoutBuild');

      builderPool._createBuildTimeout(build);
      sinon.assert.notCalled(builderPool._timeoutBuild);
      clock.tick(buildTimeout);
      sinon.assert.calledWith(builderPool._timeoutBuild, build);
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

  describe('._timeoutBuild', () => {
    const build = { buildID: 1 };

    let builderPool;

    beforeEach(() => {
      builderPool = createPool();
      sinon.stub(builderPool, 'stopBuild');
      sinon.stub(builderPool._buildTimeoutReporter, 'reportBuildTimeout');
    });

    it('calls `this.stopBuild` with the buildID of the build', () => {
      builderPool._timeoutBuild(build);

      sinon.assert.calledWith(builderPool.stopBuild, build.buildID);
    });

    it('reports the build timeout', () => {
      builderPool._timeoutBuild(build);

      sinon.assert.calledWith(builderPool._buildTimeoutReporter.reportBuildTimeout, build);
    });
  });

  describe('._requiresCustom', () => {
    it('returns false', () => {
      const builderPool = createPool();
      const build = {
        containerEnvironment: {
          OWNER: 'owner',
          REPOSITORY: 'REPO', // Checking case insensitivity as well
        },
      };
      const result = builderPool._requiresCustom(build);
      expect(result).to.be.false;
    });

    describe('when build requires custom memory', () => {
      it('returns true', () => {
        const builderPool = createPool({ customTaskMemRepos: ['owner/repo'] });
        const build = {
          containerEnvironment: {
            OWNER: 'owner',
            REPOSITORY: 'repo',
          },
        };
        const result = builderPool._requiresCustom(build);
        expect(result).to.be.true;
      });
    });
  });
});
