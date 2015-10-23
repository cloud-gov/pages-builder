# federalist-builder

This application is used to launch build tasks for Federalist in an AWS ECS Docker container based on messages from an AWS SQS queue. It limits the number of simultaneous tasks to stay under the ECS cluster's memory capacity.

It works by recursively checking an SQS queue for new messages. When a message is received, it checks an ECS cluster to see if it has capacity to run a task. If it does, it runs the task. When the task successfully returns, the message is deleted from the queue.

## Installation and configuration

Run this with `npm install` and `npm start`.

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

Additional configuration is set up through environment variables:

- `SQS_URL` the URL of the SQS queue to poll
- `ECS_CLUSTER` the name of the cluster on which tasks should run (usually `default`)
- `ECS_TASK` the name and version of the task to run (for example, `federalist-builder:4`)
- `MAX_TASKS` the maximum number of tasks that can be run at once without exceeding the cluster's resources
- `PORT` the port for health check pings. This is set automatically by CloudFoundry

## Public domain

This project is in the worldwide [public domain](LICENSE.md). As stated in [CONTRIBUTING](CONTRIBUTING.md):

> This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
>
> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest.
# federalist-builder
