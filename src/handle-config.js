const fs = require('fs');
const path = require('path');
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

const logger = require('./logger');

const TMP = '/tmp';
const CONFIG_FILE = 'pages.json';

const getContainerName = async (build) => {
  // if the user has specified a separate container in their JSON config, we use that
  try {
    const CLONE_DIR = path.join(TMP, process.env.REPOSITORY);
    await exec(`git clone -n git@github.com:${process.env.OWNER}/${process.env.REPOSITORY}.git --depth 1`, { cwd: TMP });
    const { stderr } = await exec(`git checkout HEAD ${CONFIG_FILE}`, { cwd: CLONE_DIR });
    let config = {};
    if (!stderr) {
      config = JSON.parse(fs.readFileSync(path.join(CLONE_DIR, CONFIG_FILE)));
    }
    // eslint-disable-next-line no-prototype-builtins
    if (config.hasOwnProperty('container')) {
      return config.container;
    }
  } catch (e) {
    logger.error(e);
  }
  // without the container property set, use the message value or default
  return build.containerName || 'default';
};

module.exports = {
  getContainerName,
};
