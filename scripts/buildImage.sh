#!/usr/bin/env sh

QUIET='--quiet'
VERSION=v0.1.0
Help()
{
    echo '[-v version] [-h help] [-e expect]'
}


while getopts "ev:h" flag; do
    case "${flag}" in
        v)
            VERSION="v${OPTARG}"
            ;;
        e)
            QUIET=''
            ;;
        h)
            Help
            exit 0
            ;;
        \?)
            echo "Error: Invalid option"
            exit;;
    esac
done

echo 'Checking out to most recent tag......'

git tag -l | git checkout $(tail -n 1) &&

echo 'Recent git logs: '

git lg -5

if [ "$QUIET" = "--quiet" ]; then
    echo 'Building quietly......'
else
    echo 'Building......'
fi

if ! [ -e "$PWD/node_modules/.bin/reolink" ]; then
  echo 'Error: reolink exec is not installed.' >&2
  echo '\n'
  echo 'auto installing packages......'
  npm i
fi

echo "$QUIET"

npx reolink build "$QUIET" --mode release --env sandbox --version "$VERSION" -p "$PWD"
