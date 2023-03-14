const { expect } = require('chai');
const sinon = require('sinon');
const util = require('util');
const proxyquire = require('proxyquire');
const Build = require('../src/build');

proxyquire.noCallThru();
const fakeExec = () => {};
const execStub = sinon.stub();
fakeExec[util.promisify.custom] = execStub;

const fakeReadFileSync = sinon.stub();
fakeReadFileSync.returns('{ "container": "test-container" }');

const { getContainerName } = proxyquire('../src/handle-config', {
  'node:child_process': {
    exec: fakeExec,
  },
  fs: {
    readFileSync: fakeReadFileSync,
  },
});

const env = { ...process.env };

const buildParams = {
  environment: [],
  name: 'test-build',
};

describe('handle config', () => {
  afterEach(() => {
    execStub.reset();
    process.env = env;
  });

  describe('.getContainer', () => {
    it('returns the default container without the necessary parameters', async () => {
      const build = new Build(buildParams);
      const container = await getContainerName(build);
      expect(container).to.eq('default');
    });

    it('returns the default container without a pages.json', async () => {
      process.env.REPOSITORY = 'test-repo';
      process.env.OWNER = 'test-owner';
      execStub.onCall(0).resolves(true);
      execStub.onCall(1).resolves({ stderr: "error: pathspec 'pages.json' did not match any file(s) known to git" });
      const build = new Build(buildParams);
      const container = await getContainerName(build);
      expect(container).to.eq('default');
      expect(execStub.calledTwice).to.be.true;
    });

    it('returns the specified container in pages.json', async () => {
      process.env.REPOSITORY = 'test-repo';
      process.env.OWNER = 'test-owner';
      execStub.onCall(0).resolves(true);
      execStub.onCall(1).resolves({ stdout: 'Updated 1 pats from abcdefg', stderr: null });
      const build = new Build(buildParams);
      const container = await getContainerName(build);
      expect(container).to.eq('test-container');
      expect(fakeReadFileSync.calledOnce).to.be.true;
      expect(execStub.calledTwice).to.be.true;
    });
  });
});
