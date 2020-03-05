[![CircleCI](https://circleci.com/gh/18F/federalist-builder.svg?style=svg)](https://circleci.com/gh/18F/federalist-builder)
[![Code Climate](https://codeclimate.com/github/18F/federalist-builder/badges/gpa.svg)](https://codeclimate.com/github/18F/federalist-builder)
[![Known Vulnerabilities](https://snyk.io/test/github/18F/federalist-builder/badge.svg)](https://snyk.io/test/github/18F/federalist-builder)

# federalist-builder

This application is used to launch build tasks for Federalist in containers on cloud.gov based on messages from an AWS SQS queue.

## The Build Scheduler

The Build Scheduler is the component of this app that recursively monitors SQS for new messages.
When a new messages is received, it checks the cluster to see if a container is available on which to run a build in response to the message.
If a container is available, it tells the cluster to start the build.

## The Cluster

The Cluster is responsible for being aware of what is going on in cloud.gov.
It does the following:

- Maintains a list of what build containers are running in cloud.gov, and which ones are running builds
- Starts new builds on an available container
- Marks containers as available when a build is complete
- Stops builds if they run for more than 5 minutes without calling back

The Cluster regularly queries cloud.gov's API for apps running a [federalist-garden-build](https://github.com/18F/federalist-garden-build) container and keeps a list of them.

When a build is started, it finds an available container and associates the build with the container.
Then it uses the Cloud Foundry API to update the container's environment to match the environment specified by the build and restages the container's app.

When a build is complete, the container will callback to an HTTP hook on this app with its `buildID`.
When this happens, the cluster looks up the container running the build and dissociates the build from the container.

If a build runs on a container for more than 5 minutes, the cluster will consider the build a failure, and dissociate the build from the container without a callback.

## Installation and configuration

This application uses [`yarn`](https://yarnpkg.com) to manage node dependencies.

Run this with `yarn` and `yarn start`.

The AWS SDK credentials should be in place, or if running on CloudFoundry, a `federalist-aws-creds` service available.

The SQS message body should be JSON that takes the form of an ECS task override object:

```js
{
  "command": [
    "STRING_VALUE",
    /* more items */
  ],
  "environment": [
    {
      "name": "STRING_VALUE",
      "value": "STRING_VALUE"
    },
    /* more items */
  ],
  "name": "STRING_VALUE"
}
```

Private configuration values should be in a cloud.gov user-provided service named `federalist-builder-env`:

- `NEW_RELIC_LICENSE_KEY` the private New Relic license key

Additional configuration is set up through environment variables:

- `BUILD_TIMEOUT_SECONDS`: (required) number of seconds to let a build run before timing out
- `BUILD_CONTAINER_DOCKER_IMAGE_NAME` (required) the name of the docker image that is used to run builds
- `CLOUD_FOUNDRY_OAUTH_TOKEN_URL` (required) the OAuth2 token URL for Cloud Foundry, e.g. `https://login.fr.cloud.gov`
- `DEPLOY_USER_USERNAME` (required) the username for the deploy user that starts builds in cloud.gov.
- `DEPLOY_USER_PASSWORD` (required) the password for the deploy user that starts builds in cloud.gov.
- `LOG_LEVEL` the log level for [winston](https://github.com/winstonjs/winston#logging-levels). Defaults to "info".
- `NEW_RELIC_APP_NAME` the name of the app in New Relic
- `PORT` the port for the server that handles healthcheck pings and build callbacks
- `EXPECTED_NUM_BUILD_CONTAINERS` (required) the expected number of build containers to be running

## Running locally

`federalist-builder` is not currently designed to be run locally. Due to its tight coupling with the build process and its dependence on the Cloud Foundry environment, running it locally has the potential to create a race condition between builds running in Cloud Foundry and builds that were scheduled locally.

To locally test `federalist-builder`, you can run:

```
yarn
yarn test
```

## Public domain

This project is in the worldwide [public domain](LICENSE.md). As stated in [CONTRIBUTING](CONTRIBUTING.md):

> This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
>
> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest.
