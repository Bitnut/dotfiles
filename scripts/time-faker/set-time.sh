#!/bin/sh

 # 检查是否提供了时间参数
 if [ "$#" -ne 1 ]; then
     echo "用法: $0 <时间参数 (YYYY-MM-DD)>"
     exit 1
 fi

 TIME_PARAM=$1

 echo "restarting service..."

 docker-compose -f /www/us-dev/device/SimCard/MockSerria/docker-compose.yml restart > /dev/null 2>&1 &
 docker-compose -f /www/us-dev/device/SimCard/SimCardOperatorTelenor/docker-compose.yml restart > /dev/null 2>&1 &
 docker-compose -f /www/us-dev/device/SimCard/SimCardConsumer/docker-compose.yml restart > /dev/null 2>&1 &
 docker-compose -f /www/us-dev/device/SimCard/SimCardScheduler/docker-compose.yml restart > /dev/null 2>&1

 sleep 10

 wait

 echo "restarting service complete"

 docker exec -it svc-dev-us-cloud-subscriptions npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 docker exec -it svc-dev-us-cloud-subscription-storage npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 docker exec -it svc-dev-us-cloud-sub-bill npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 docker exec -it svc-dev-us-mock-serria npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 docker exec -it svc-dev-us-sim-card-telenor-accounting npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 # docker exec -it svc-dev-us-sim-card-operator-telenor npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 docker exec -it svc-dev-us-sim-card-core npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 docker exec -it svc-dev-us-sim-card-scheduler npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
 docker exec -it svc-dev-us-sim-card-task-consumer npx reolink control command set-current-time "{\"now\":\"$TIME_PARAM\"}"
