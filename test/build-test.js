const expect = require('chai').expect;
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

describe('Build', () => {
  describe('constructor', () => {
    it('should set a buildID', () => {
      const build = new Build(sqsMessage);
      expect(build.buildID).to.be.a('string');
    });

    it('should set the container environment from an SQS message', () => {
      const build = new Build(sqsMessage);
      expect(build.containerEnvironment).to.have.property('OVERRIDE_A', 'VALUE A');
      expect(build.containerEnvironment).to.have.property('OVERRIDE_B', 'VALUE B');
      expect(build.containerEnvironment).to.have.property('OVERRIDE_C', 'VALUE C');
    });

    it('should add the FEDERALIST_BUILDER_CALLBACK to the container environment', () => {
      const build = new Build(sqsMessage);
      expect(build.containerEnvironment).to.have.property(
        'FEDERALIST_BUILDER_CALLBACK',
        `https://example.com/builds/${build.buildID}/callback`
      );
    });
  });
});
