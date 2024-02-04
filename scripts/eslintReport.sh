#!/bin/sh
# requirement npx/eslint
# target js/ts files
# only modified files tracked by git

for i in "$@"; do
  case $i in
    -c=*|--config=*)
      ESLINT_CONF="${i#*=}"
      shift # past argument=value
      ;;
    -a=*|--all=*)
      ESLINT_ALL="1"
      shift # past argument=value
      ;;
    -i=*|--ignore=*)
      ESLINT_IGNORE="${i#*=}"
      shift # past argument=value
      ;;
    *)
      # unknown option
      ;;
  esac
done

if [ -z "$ESLINT_CONF" ]; then

    ESLINT_CONF=".eslintrc"
fi

if [ -z "$ESLINT_IGNORE" ]; then

    ESLINT_IGNORE=".eslintignore"
fi

if [ -z "$ESLINT_ALL" ]; then

    ESLINT_ALL="0"
fi

npx eslint -c ${ESLINT_CONF} --ignore-path ${ESLINT_IGNORE} $( git status --porcelain | awk '$1!="D" {if ($1=="R") { print $4 } else { print $2 }}' | grep -E '(.ts)$' ) --fix

if [ $? -ne 0 ]; then
    echo -e "ERROR: Please check eslint hints.\n"
    npx eslint -c ${ESLINT_CONF} --ignore-path ${ESLINT_IGNORE}  $( git status --porcelain | awk '$1!="D" {if ($1=="R") { print $4 } else { print $2 }}' | grep -E '(.ts)$' ) -f unix | head -n -2  | awk '{print $NF}' >> eslintReport.log;
    echo -e "Hightest eslint error/warning\n";
    echo -e "times\terror"
    cat ./eslintReport.log | sort | uniq -c | sort -rn | head -n 10
    exit 1
fi

echo "Perfect coding format!"
