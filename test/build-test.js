const { expect } = require('chai');
const Build = require('../src/build');

const sqsMessage = {
  Body: JSON.stringify({
    environment: [
      { name: 'OVERRIDE_A', value: 'VALUE A' },
      { name: 'OVERRIDE_B', value: 'VALUE B' },
      { name: 'OVERRIDE_C', value: 'VALUE C' },
    ],
    name: 'Conatiner Name',
  }),
};

const bullMessage = {
  data: {
    environment: [
      { name: 'OVERRIDE_A', value: 'VALUE A' },
      { name: 'OVERRIDE_B', value: 'VALUE B' },
      { name: 'OVERRIDE_C', value: 'VALUE C' },
    ],
    name: 'Conatiner Name',
  },
};

describe('Build', () => {
  describe('constructor', () => {
    it('should set a buildID', () => {
      const build = new Build(sqsMessage);
      expect(build.buildID).to.be.a('string');
    });

    describe('SQS Queue', () => {
      it('should set the container environment from a queue message', () => {
        const build = new Build(sqsMessage);
        expect(build.containerEnvironment).to.have.property('OVERRIDE_A', 'VALUE A');
        expect(build.containerEnvironment).to.have.property('OVERRIDE_B', 'VALUE B');
        expect(build.containerEnvironment).to.have.property('OVERRIDE_C', 'VALUE C');
      });

      it('should add the FEDERALIST_BUILDER_CALLBACK to the container environment', () => {
        const build = new Build(sqsMessage);
        expect(build.containerEnvironment).to.have.property(
          'FEDERALIST_BUILDER_CALLBACK',
          `http://localhost:3000/builds/${build.buildID}/callback`
        );
      });
    });
    describe('Bull Queue', () => {
      it('should set the container environment from a queue message', () => {
        const build = new Build(bullMessage, true);
        expect(build.containerEnvironment).to.have.property('OVERRIDE_A', 'VALUE A');
        expect(build.containerEnvironment).to.have.property('OVERRIDE_B', 'VALUE B');
        expect(build.containerEnvironment).to.have.property('OVERRIDE_C', 'VALUE C');
      });

      it('should add the FEDERALIST_BUILDER_CALLBACK to the container environment', () => {
        const build = new Build(bullMessage, true);
        expect(build.containerEnvironment).to.have.property(
          'FEDERALIST_BUILDER_CALLBACK',
          `http://localhost:3000/builds/${build.buildID}/callback`
        );
      });
    });
  });
});
