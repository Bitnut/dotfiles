#!/usr/bin/env sh

# Helper function for printing usage
print_usage() {
    echo "Usage: $1"
}

# Function to map a remote port to a local port
map_port_to_local() {
    local local_host=${1:-127.0.0.1}
    local local_port=${2}
    local remote_host=${3}
    local remote_port=${4}

    if [[ -z "$remote_host" ]] || [[ -z "$remote_port" ]]; then
        print_usage "map_port_to_local [local_host] local_port remote_host remote_port"
        return 1
    fi

    if [[ -z "$local_port" ]]; then
        local_port=$remote_port
    fi

    echo "Mapping $remote_host:$remote_port [Remote] -> $local_host:$local_port [Local]"

    ssh -o StrictHostKeyChecking=no -4 $remote_host -N -L $local_host:$local_port:127.0.0.1:$remote_port
}

# Function to map a Docker container's debug port to a local port
map_docker_debug_port_to_local() {
    local container_keyword=$1
    local docker_bind_port=$2
    local remote_host=$3
    local docker_bind_host=${4:-0.0.0.0}
    local local_port=${5}

    if [[ -z "$container_keyword" ]] || [[ -z "$docker_bind_port" ]] || [[ -z "$remote_host" ]]; then
        print_usage "map_docker_debug_port_to_local container_keyword docker_bind_port remote_host [docker_bind_host] [local_port]"
        return 1
    fi

    local count=$(ssh $remote_host docker ps | grep -E "(^|\s)$container_keyword($|\s)" | wc -l)

    if [[ $count -ne 1 ]]; then
        echo "Found $count containers with name '$container_keyword', please specify a more clear name."
        return 1
    fi

    local remote_port=$(ssh $remote_host docker ps | grep -E "(^|\s)$container_keyword($|\s)" | grep -Eo "$docker_bind_host:[0-9]+->$docker_bind_port" | cut -d ':' -f 2 | grep -Eo '^[0-9]+')

    if [[ -z "$remote_port" ]]; then
        echo "Cannot find port mapping for $container_keyword:$docker_bind_port"
        return 1
    fi

    map_port_to_local $docker_bind_host $local_port $remote_host $remote_port
}

# Example usage
# map_docker_debug_port_to_local svc-dev-us-shop-order 2333 hpc@inner-test 0.0.0.0 12345
