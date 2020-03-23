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
  describe('.canStartBuild', () => {
    it('returns a promise that resolves to the value of calling _hasAvailableMemory()', async () => {
      const foobar = 'foobar';
      const builderPool = createPool();
      const hasAvailableMemoryStub = sinon
        .stub(builderPool, '_hasAvailableMemory')
        .resolves(foobar);

      const result = await builderPool.canStartBuild();

      expect(hasAvailableMemoryStub.calledOnce).to.be.true;
      expect(result).to.eq(foobar);
    });
  });

  describe('.start', () => {
    describe('when the Cloud Foundry application was found', () => {
      const taskAppName = 'taskAppName';
      const taskAppGUID = 'taskAppGUID';
      let builderPool;
      let fetchAppByNameStub;
      let result;

      before(async () => {
        builderPool = createPool({ taskAppName });

        fetchAppByNameStub = sinon
          .stub(builderPool._apiClient, 'fetchAppByName')
          .resolves({ guid: taskAppGUID });

        result = await builderPool.start();
      });

      it('calls CF API fetchAppByName with the taskAppName', () => {
        expect(fetchAppByNameStub.calledWith(taskAppName)).to.be.true;
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
      let fetchAppByNameStub;
      let result;

      before(async () => {
        builderPool = createPool({ taskAppName });

        fetchAppByNameStub = sinon
          .stub(builderPool._apiClient, 'fetchAppByName')
          .resolves(null);

        result = await builderPool.start().catch(error => error);
      });

      it('calls CF API fetchAppByName with the taskAppName', () => {
        expect(fetchAppByNameStub.calledWith(taskAppName)).to.be.true;
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
      let fetchAppByNameStub;
      let result;

      before(async () => {
        builderPool = createPool({ taskAppName });

        fetchAppByNameStub = sinon
          .stub(builderPool._apiClient, 'fetchAppByName')
          .rejects(error);

        result = await builderPool.start().catch(err => err);
      });

      it('calls CF API fetchAppByName with the taskAppName', () => {
        expect(fetchAppByNameStub.calledWith(taskAppName)).to.be.true;
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

  });

  describe('.stop', () => {
    it('does nothing and returns true', () => {
      const builderPool = createPool();
      expect(builderPool.stop()).to.be.true;
    });
  });

  describe('.stopBuild', () => {

  });

  describe('._setTaskAppGUID', () => {

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

  });

  describe('._hasAvailableMemory', () => {

  });

  describe('._timeoutBuild', () => {

  });
});
