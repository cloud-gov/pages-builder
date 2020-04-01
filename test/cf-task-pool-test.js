const { expect } = require('chai');
const sinon = require('sinon');

const CFTaskPool = require('../src/cf-task-pool');

const defaults = {
  buildTimeout: 1000,
  maxTaskMemory: 30 * 1024,
  taskDisk: 4 * 1024,
  taskMemory: 2 * 1024,
  url: 'http://example.com',
  taskAppName: 'taskApp',
  taskAppCommand: 'echo',
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
      const foobar = 'foobar';
      const builderPool = createPool();
      sinon
        .stub(builderPool, '_hasAvailableMemory')
        .resolves(foobar);

      const result = await builderPool.canStartBuild();

      sinon.assert.calledOnce(builderPool._hasAvailableMemory);
      expect(result).to.eq(foobar);
    });
  });

  describe('.start', () => {
    describe('when the Cloud Foundry application was found', () => {
      const taskAppName = 'taskAppName';
      const taskAppGUID = 'taskAppGUID';
      let builderPool;
      let result;

      before(async () => {
        builderPool = createPool({ taskAppName });

        sinon
          .stub(builderPool._apiClient, 'fetchAppByName')
          .resolves({ guid: taskAppGUID });

        result = await builderPool.start();
      });

      it('calls CF API fetchAppByName with the taskAppName', () => {
        sinon.assert.calledWith(builderPool._apiClient.fetchAppByName, taskAppName);
      });

      it('sets the taskAppGUID returned from the CF Api', () => {
        expect(builderPool._taskAppGUID).to.eq(taskAppGUID);
      });

      it('returns a promise that resolves to `true`', () => {
        expect(result).to.be.true;
      });
    });

    describe('when the Cloud Foundry application cannot be found', () => {
      const taskAppName = 'taskAppName';
      let builderPool;
      let result;

      before(async () => {
        builderPool = createPool({ taskAppName });

        sinon
          .stub(builderPool._apiClient, 'fetchAppByName')
          .resolves(null);

        result = await builderPool.start().catch(error => error);
      });

      it('calls CF API fetchAppByName with the taskAppName', () => {
        sinon.assert.calledWith(builderPool._apiClient.fetchAppByName, taskAppName);
      });

      it('returns a rejected promise with an error', () => {
        expect(result).to.be.an.instanceOf(Error);
        expect(result.message).to.eq(`Unable to find application with name: ${taskAppName}`);
      });

      it('does not set the taskAppGUID', () => {
        expect(builderPool._taskAppGUID).to.be.null;
      });
    });

    describe('when there is an error using the Cloud Foundry api', () => {
      const taskAppName = 'taskAppName';
      const error = new Error('Hello World');
      let builderPool;
      let result;

      before(async () => {
        builderPool = createPool({ taskAppName });

        sinon
          .stub(builderPool._apiClient, 'fetchAppByName')
          .rejects(error);

        result = await builderPool.start().catch(err => err);
      });

      it('calls CF API fetchAppByName with the taskAppName', () => {
        sinon.assert.calledWith(builderPool._apiClient.fetchAppByName, taskAppName);
      });

      it('returns a rejected promise with an error', () => {
        expect(result).to.be.an.instanceOf(Error);
        expect(result.message).to.eq(error.message);
      });

      it('does not set the taskAppGUID', () => {
        expect(builderPool._taskAppGUID).to.be.null;
      });
    });
  });

  describe('.startBuild', () => {
    const taskAppGUID = 'abc123';
    const timeOutHandle = 1;
    const task = {
      name: 'task',
      guid: 'def987',
    };
    const build = { buildID: 1, containerEnvironment: {} };

    let builderPool;
    let getBuildTask;

    beforeEach(() => {
      builderPool = createPool();
      builderPool._taskAppGUID = taskAppGUID;

      const buildTaskSpy = sinon.spy(builderPool, '_buildTask');
      sinon.stub(builderPool, '_createBuildTimeout').returns(timeOutHandle);

      getBuildTask = () => buildTaskSpy.getCall(0).returnValue;
    });

    describe('when successful', () => {
      it('starts the task in CF and adds the build GUID and timeout to an in-memory cache', async () => {
        sinon.stub(builderPool._apiClient, 'startTaskForApp').resolves(task);

        expect(builderPool._builds[build.buildID]).to.be.undefined;

        await builderPool.startBuild(build);

        sinon.assert.calledWith(builderPool._buildTask, build);
        sinon.assert.calledWith(
          builderPool._apiClient.startTaskForApp, getBuildTask(), taskAppGUID
        );

        expect(builderPool._builds[build.buildID]).to.deep.equal({
          taskGUID: 'def987',
          timeout: timeOutHandle,
        });
      });
    });

    describe('when there is an error', () => {
      it('rejects with a TaskStartError', async () => {
        sinon.stub(builderPool._apiClient, 'startTaskForApp').rejects(new Error('uh oh'));

        expect(builderPool._builds[build.buildID]).to.be.undefined;

        const result = await builderPool.startBuild(build).catch(error => error);

        sinon.assert.calledWith(builderPool._buildTask, build);
        sinon.assert.calledWith(
          builderPool._apiClient.startTaskForApp, getBuildTask(), taskAppGUID
        );

        expect(result).be.a('error');
        expect(result.message).to.eq('uh oh');
        expect(builderPool._builds[build.buildID]).to.be.undefined;
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

  describe('._setTaskAppGUID', () => {
    describe('when the app cannot be found', () => {
      it('does not set the task app guid', async () => {
        const builderPool = createPool();
        sinon.stub(builderPool._apiClient, 'fetchAppByName')
          .resolves(null);

        await builderPool._setTaskAppGUID('foobar').catch(error => error);

        expect(builderPool._taskAppGUID) === null;
      });

      it('rejects with an error', async () => {
        const builderPool = createPool();
        sinon.stub(builderPool._apiClient, 'fetchAppByName')
          .resolves(null);

        const result = await builderPool._setTaskAppGUID('foobar').catch(error => error);
        expect(result).to.be.an('error');
      });
    });

    describe('when the app is found', () => {
      it('sets the task app guid', async () => {
        const appGUID = 1;

        const builderPool = createPool();
        sinon.stub(builderPool._apiClient, 'fetchAppByName')
          .resolves({ guid: appGUID });

        await builderPool._setTaskAppGUID('foobar');

        expect(builderPool._taskAppGUID) === appGUID;
      });

      it('resolves true', async () => {
        const builderPool = createPool();
        sinon.stub(builderPool._apiClient, 'fetchAppByName')
          .resolves({ guid: 1 });

        const result = await builderPool._setTaskAppGUID('foobar');

        expect(result).to.be.true;
      });
    });
  });

  describe('._buildTask', () => {
    it('returns an object containing name, memory, disk, and command for task', () => {
      const expectedKeys = ['name', 'disk_in_mb', 'memory_in_mb', 'command'];
      const buildId = 1234;
      const taskAppCommand = 'command';

      const build = {
        containerEnvironment: {
          BUILD_ID: buildId,
        },
      };
      const builderPool = createPool({ taskAppCommand });
      const result = builderPool._buildTask(build);

      expect(result).to.be.an('object');
      expectedKeys.forEach(key => expect(result[key]).to.exist);
      expect(result.name).to.include(buildId);
      expect(result.command).to.include(taskAppCommand);
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
        sinon.stub(builderPool._apiClient, 'fetchActiveTasksForApp')
          .resolves([
            { memory_in_mb: taskMemory },
            { memory_in_mb: taskMemory },
          ]);

        const hasAvailableMemory = await builderPool._hasAvailableMemory();
        expect(hasAvailableMemory).to.be.false;
      });
    });

    describe('when there is enough memory', () => {
      it('returns true ', async () => {
        const builderPool = createPool({ taskMemory, maxTaskMemory });
        sinon.stub(builderPool._apiClient, 'fetchActiveTasksForApp')
          .resolves([{ memory_in_mb: taskMemory }]);

        const hasAvailableMemory = await builderPool._hasAvailableMemory();
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
});
