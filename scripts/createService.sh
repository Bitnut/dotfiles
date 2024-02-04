#!/bin/sh

if [ "$#" -ne 2 ]; then
    echo "Lack of args!"
    echo "Usage: $0 service-name git-repo"
    exit 1
fi

echo "Installing reolink-fx/cli"
echo "......"

npm install @reolink-fx/cli

echo "Creating project: $1 in $PWD"
echo "......"

npx reolink create -t service -p $PWD

echo "Cleaning working dir..."

echo "Delete all README recursivly in curr folder."
find . -name "README*" -type f -delete

echo "Preparing working env"

cp ~/scripts/eslintReport.sh .
echo ".log/" >> .gitignore
echo "eslintReport*">> .gitignore

echo "Stage all files"

echo "Git operations..."
git remote add origin $2
git fetch origin
git branch master origin/master
git checkout -b hpc-dev
git add .
