const crypto = require('crypto');
const url = require('url');

class Build {
  constructor(sqsMessage) {
    this.sqsMessage = sqsMessage;
    this.buildID = this._generateBuildID();
    this.containerEnvironment = this._resolveContainerEnvironment(
      this.buildID,
      this.sqsMessage
    );
  }

  _buildCallbackURL(buildID) {
    return url.resolve(
      process.env.BUILD_COMPLETE_CALLBACK_HOST,
      `builds/${buildID}/callback`
    );
  }

  _generateBuildID() {
    return crypto.randomBytes(48).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  _resolveContainerEnvironment(buildID, sqsMessage) {
    const environmentOverrides = JSON.parse(sqsMessage.Body).environment;

    const environment = environmentOverrides.reduce(
      (env, environmentOverride) => Object.assign(env, {
        [environmentOverride.name]: environmentOverride.value,
      }), {}
    );

    environment.FEDERALIST_BUILDER_CALLBACK = this._buildCallbackURL(buildID);

    return environment;
  }

  federalistBuildId() {
    return this.containerEnvironment.buildID;
  }
}

module.exports = Build;
