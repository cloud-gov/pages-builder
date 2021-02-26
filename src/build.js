const crypto = require('crypto');
const url = require('url');
const appEnv = require('../env');

class Build {
  constructor(queueMessage, isBullQueue = false) {
    this.queueMessage = queueMessage;
    this.buildID = this._generateBuildID();
    this._resolveContainerEnvironment(
      this.buildID,
      this.queueMessage,
      isBullQueue
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

  _resolveContainerEnvironment(buildID, queueMessage, isBullQueue) {
    let containerName;
    let containerSize;
    let environment;

    if (isBullQueue) {
      ({
        containerName,
        containerSize,
        environment,
      } = queueMessage.data);
    } else {
      ({
        containerName,
        containerSize,
        environment,
      } = JSON.parse(queueMessage.Body));
    }

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

  federalistBuildId() {
    return this.containerEnvironment.BUILD_ID;
  }
}

module.exports = Build;
