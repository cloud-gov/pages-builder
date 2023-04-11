[![Known Vulnerabilities](https://snyk.io/test/github/cloud-gov/pages-builder/badge.svg)](https://snyk.io/test/github/cloud-gov/pages-builder)

# pages-builder

This application is used to launch build tasks for cloud.gov Pages in containers on cloud.gov based on messages from a Redis queue.

## The Build Scheduler

The Build Scheduler is the component of this app that recursively monitors Redis for new messages. When a new messages is received, it checks the cluster to see if enough resources are available to run a build, and if so, starts the build as a Cloud Foundry "Task".

## The Task Pool

The Task Pool is responsible for being aware of what is going on in cloud.gov.
It does the following:

- Starts new build task if resources are available

The Task Pool starts a build as a Cloud Foundry "Task" with the contents of the build message.

If a build task runs for more than 5 minutes, the cluster will consider the build a failure, and dissociate the build from the container without a callback.

## Installation and configuration

This application uses [`yarn`](https://yarnpkg.com) to manage node dependencies.

Run this with `yarn` and `yarn start`.

The Redis message body should be JSON that takes the form of an ECS task override object:

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

Configuration values for NEW RELIC are set in the app's Cloud Foundry environment variables:

- `NEW_RELIC_APP_NAME` the name of the app in New Relic
- `NEW_RELIC_LICENSE_KEY` the private New Relic license key

Additional configuration is set up through environment variables:

- `CLOUD_FOUNDRY_OAUTH_TOKEN_URL`: (required) the OAuth2 token URL for Cloud Foundry, e.g. `https://login.fr.cloud.gov`
- `LOG_LEVEL`: the log level for [winston](https://github.com/winstonjs/winston#logging-levels). Defaults to "info".
- `PORT`: (local/test only) the port for the server that handles healthcheck pings and build callbacks
- `TASK_MEM_GB`: default memory allocated to a build task in GB
- `TASK_DISK_GB`: default disk allocated to a build task in GB
- `TASK_MAX_MEM_GB`: total memory allowed to be allocated for build tasks in GB
- `TASK_CUSTOM_MEM_GB`: memory allocated to a `large` build task in GB
- `TASK_CUSTOM_DISK_GB`: disk allocated to a `large` build task in GB

## Running locally

`pages-builder` is not currently designed to be run locally. Due to its tight coupling with the build process and its dependence on the Cloud Foundry environment, running it locally has the potential to create a race condition between builds running in Cloud Foundry and builds that were scheduled locally.

To locally test `pages-builder`, you can run:

```
yarn
yarn test
```

### Using docker to test locally

Since `pages-builder` has tightly coupled build process, a dependence on the Cloud Foundry platform, and third party services, running tests locally with `docker-compose` can make the development experience a bit simpler.

To build the containers run:
`$ docker-compose build`

To install the dependencies run:
`$ docker-compose run app yarn`

To test the builder run:
`$ docker-compose run app yarn test`

#### CI deployments
This repository contains two distinct deployment pipelines in concourse:
- [__Builder__](./ci/pipeline.yml)
- [__Builder Dev__](./ci/pipeline-dev.yml)

__Builder__ deploys the Pages app/api, the admin app, and the queues app. __Metrics__ deploys concourse tasks to check our app/infrastructure health.

__*&#8595; NOTICE &#8595;*__

> __Builder Dev__ deploys the Pages builder app when a PR is created into the `staging` branch. This uses a unique pipeline file: [./ci/pipeline-dev.yml](./ci/pipeline-dev.yml)

##### Pipeline instance variables
Two instances of the pipeline are set for the `pages staging` and `pages production` environments. Instance variables are used to fill in Concourse pipeline parameter variables bearing the same name as the instance variable. See more on [Concourse vars](https://concourse-ci.org/vars.html). Each instance of the pipeline has three instance variables associated to it: `deploy-env`, `git-branch`. `product`

|Instance Variable|Pages Dev|Pages Staging|Pages Production|
--- | --- | ---| ---|
|**`deploy-env`**|`dev`|`staging`|`production`|
|**`git-branch`**|`staging`|`staging`|`main`|


## Public domain

This project is in the worldwide [public domain](LICENSE.md). As stated in [CONTRIBUTING](CONTRIBUTING.md):

> This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
>
> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest.
