#!/bin/bash

set -e

if [ "$TRAVIS_BRANCH" == "master" ]
then
  CF_SPACE="prod"
  CF_APP="federalist-builder"
  CF_MANIFEST="manifest.yml"
elif [ "$TRAVIS_BRANCH" == "staging" ]
then
  CF_SPACE="staging"
  CF_APP="federalist-builder-staging"
  CF_MANIFEST="staging_manifest.yml"
else
  exit
fi

wget https://s3.amazonaws.com/go-cli/releases/v6.12.4/cf-cli_amd64.deb -qO temp.deb && sudo dpkg -i temp.deb

rm temp.deb

cf api $CF_API
cf login --u $CF_USERNAME --p $CF_PASSWORD --o $CF_ORGANIZATION --s $CF_SPACE

cf zero-downtime-push $CF_APP -f $CF_MANIFEST

cf logout
