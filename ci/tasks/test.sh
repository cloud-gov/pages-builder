#!/usr/bin/env bash

set -euo pipefail

curl -L https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64 > ./cc-test-reporter
chmod +x ./cc-test-reporter
./cc-test-reporter before-build

yarn test:cover; status=$?

# Attempt to submit a report, but don't fail the build if this fails (`|| true`)
./cc-test-reporter after-build --exit-code $? < coverage/lcov.info || true

exit $status