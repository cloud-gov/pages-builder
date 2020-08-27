const crypto = require('crypto');
const url = require('url');
const appEnv = require('../env');

class Build {
  constructor(sqsMessage) {
    this.sqsMessage = sqsMessage;
    this.buildID = this._generateBuildID();
    this._resolveContainerEnvironment(
      this.buildID,
      this.sqsMessage
    );
  }

  _buildCallbackURL(buildID) {
    return url.resolve(appEnv.url, `builds/${buildID}/callback`);
  }

  _generateBuildID() {
    return crypto.randomBytes(48).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  _resolveContainerEnvironment(buildID, sqsMessage) {
    const {
      containerName,
      containerSize,
      environment,
    } = JSON.parse(sqsMessage.Body);

    const containerEnvironment = environment.reduce(
      (env, { name, value }) => ({ ...env, [name]: value }),
      {}
    );

    containerEnvironment.FEDERALIST_BUILDER_CALLBACK = this._buildCallbackURL(buildID);

    // force a string, might no longer be necessary
    containerEnvironment.BUILD_ID = `${containerEnvironment.BUILD_ID}`;

    this.containerEnvironment = containerEnvironment;
    this.containerName = containerName;
    this.containerSize = containerSize;
  }
}

module.exports = Build;
