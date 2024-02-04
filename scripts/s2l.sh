#!/bin/bash

SSH_USER=sshtunnel
SSH_PORT=2222
SSH_HOST=apis.reolink.dev

Help()
{
    echo '[-i identitfy_file] [-h help] [-l local_port] [-s service_host] [-p service_port]'
}


while getopts "i:l:s:p:h" flag; do
    case "${flag}" in
        i)
            identity_file=${OPTARG}
            ;;
        l)
            local_port=${OPTARG}
            ;;
        s)
            service_host=${OPTARG}
            ;;
        p)
            service_port=${OPTARG}
            ;;
        h)
            Help
            exit 0
            ;;
        \?) # incorrect option
            echo "Error: Invalid option"
            exit;;
    esac
done

if [ -z "$local_port" ]; then
    echo 'Lackof local_port!'
    exit 1
fi

if [ -z "$service_host" ]; then
    echo 'Lackof service_host!'
    exit 1
fi

if [ -z "$service_port" ]; then
    echo 'Lackof service_port!'
    exit 1
fi

echo "using identity_file: $identity_file"
echo "using user: $SSH_USER"
echo "using remote port: $SSH_PORT"
echo "using host: $SSH_HOST"
echo "Trying to use mapping: 0.0.0.0:$local_port <--> $service_host:$service_port"

ssh \
    -o 'StrictHostKeyChecking=no' \
    -4 \
    -i "$identity_file" \
    -p "$SSH_PORT" \
    "$SSH_USER@$SSH_HOST" \
    -N \
    -L "0.0.0.0:$local_port:$service_host:$service_port"
