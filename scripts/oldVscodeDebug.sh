#!/usr/bin/env sh

export SSH_MAP_REMOTE_HOST=hpc@inner-test
export SSH_MAP_REMOTE_PORT=22
export DOCKER_BIND_PORT=2333
## 服务信息
export DOCKER_NAME_KEYWORD=svc-dev-us-shop-order
export SSH_MAP_LOCAL_PORT=12345

## 方法
ssh-map-port-to-local() {

    local LOCAL_HOST=$SSH_MAP_LOCAL_HOST
    local LOCAL_PORT=$SSH_MAP_LOCAL_PORT

    if [[ -z "$SSH_MAP_REMOTE_HOST" ]] || [[ -z "$SSH_MAP_REMOTE_PORT" ]]; then
        echo "Usage: ssh-map-port-to-local"
        echo "  env export SSH_MAP_REMOTE_HOST=admin@192.168.2.91 [Required]"
        echo "  env export SSH_MAP_REMOTE_PORT=12345              [Required]"
        echo "  env export SSH_MAP_LOCAL_HOST=0.0.0.0             [Default: 127.0.0.1]"
        echo "  env export SSH_MAP_LOCAL_PORT=23456               [Default: \$SSH_MAP_REMOTE_PORT]"
        return 1
    fi

    if [[ -z "$LOCAL_HOST" ]]; then
        LOCAL_HOST=127.0.0.1
    fi

    if [[ -z "$LOCAL_PORT" ]]; then
        LOCAL_PORT=$SSH_MAP_REMOTE_PORT
    fi

    echo "Mapping $SSH_MAP_REMOTE_HOST:$SSH_MAP_REMOTE_PORT [Remote] -> $LOCAL_HOST:$LOCAL_PORT [Local]"

    ssh \
        -o StrictHostKeyChecking=no \
        -4 \
        $SSH_MAP_REMOTE_HOST \
        -N \
        -L $LOCAL_HOST:$LOCAL_PORT:127.0.0.1:$SSH_MAP_REMOTE_PORT
}

ssh-map-docker-debug-port-to-local() {

    if [ -z "$DOCKER_NAME_KEYWORD" ] || [ -z "$DOCKER_BIND_PORT" ] || [ -z "$SSH_MAP_REMOTE_HOST" ]; then
        echo "Usage: ssh-map-docker-debug-port-to-local"
        echo "  env export DOCKER_NAME_KEYWORD=event-collector    [Required]"
        echo "  env export DOCKER_BIND_PORT=12345                 [Required]"
        echo "  env export SSH_MAP_REMOTE_HOST=admin@192.168.2.91 [Required]"
        echo "  env export DOCKER_BIND_HOST=127.0.0.1             [Default: 0.0.0.0]"
        echo "  env export SSH_MAP_LOCAL_HOST=0.0.0.0             [Default: 127.0.0.1]"
        echo "  env export SSH_MAP_LOCAL_PORT=23456               [Default: Same port in remote]"
        return 1
    fi

    if [[ -z "$DOCKER_BIND_HOST" ]]; then
        DOCKER_BIND_HOST=0.0.0.0
    fi

    COUNT=$(ssh $SSH_MAP_REMOTE_HOST docker ps | grep "$DOCKER_NAME_KEYWORD" | wc -l)

    if [[ $COUNT -ne 1 ]]; then
        echo "Found $COUNT containers with name '$DOCKER_NAME_KEYWORD', please speficy a more clear name."
        return 1
    fi

    export SSH_MAP_REMOTE_PORT=$(
        ssh $SSH_MAP_REMOTE_HOST docker ps |
        grep "$DOCKER_NAME_KEYWORD" |
        grep -Eo "$DOCKER_BIND_HOST:[0-9]+->$DOCKER_BIND_PORT" |
        cut -d ':' -f 2 |
        grep -Eo '^[0-9]+'
    )

    if [[ -z "$SSH_MAP_REMOTE_PORT" ]]; then
        echo "Cannot find port mapping for $DOCKER_NAME_KEYWORD:$DOCKER_BIND_PORT"
        return 1
    fi

    ssh-map-port-to-local
}
