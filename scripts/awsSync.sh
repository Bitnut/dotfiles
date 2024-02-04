#!/bin/sh

aws s3 sync s3://reolink-storage/runtime/logs/live/cloud/services_shop/ . --exclude * $(aws s3 ls s3://reolink-storage/runtime/logs/live/cloud/services_shop/ --profile huangpinchao | grep -E '2021-(08|09|10|11).{4}json' | cut -c  31- | awk '{print "--include " $1}') --profile huangpinchao


aws s3 sync s3://reolink-storage/runtime/logs/live/cloud/services_payments/ . --exclude * $(aws s3 ls s3://reolink-storage/runtime/logs/live/cloud/services_relay_traffic/ --profile huangpinchao | grep -E '2023-(07).{4}json' | cut -c  31- | awk '{print "--include " $1}') --profile huangpinchao
aws s3 ls s3://reolink-storage/runtime/logs/live/cloud/services_relay_traffic/ --profile huangpinchao
