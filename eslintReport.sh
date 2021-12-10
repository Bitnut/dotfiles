#!/bin/sh
# requirement npx/eslint/git
# target JS/TS files
# only modified files tracked by git

for i in "$@"; do
    case $i in
        -c=*|--config=*)
            ESLINT_CONF="${i#*=}"
            shift # past argument=value
            ;;
        -i=*|--ignore=*)
            ESLINT_IGNORE="${i#*=}"
            shift # past argument=value
            ;;
        -h|--help)
            echo "-c=/--config= use eslint config file\n-i=/--ignore= use eslint ignore file"
            exitFlag=1
            shift # past argument=value
            ;;
        *)
            # unknown option
            ;;
    esac
done

if [[ "$exitFlag" -eq 1 ]]; then

    exit 0;
fi

if [[  -z "$ESLINT_CONF" ]]; then

    ESLINT_CONF=".eslintrc"
fi

if [[ -z "$ESLINT_IGNORE" ]]; then

    ESLINT_IGNORE=".eslintignore"
fi

LOG_FILE="$(basename "$0" | cut -f 1 -d '.').log"

echo "./$LOG_FILE"

npx eslint -c ${ESLINT_CONF} --ignore-path ${ESLINT_IGNORE} $( git status --porcelain | awk '$1!="D" {if ($1=="R") { print $4 } else { print $2 }}' | grep -E '(.ts|.js)$' ) --fix

if [ $? -ne 0 ]; then
    echo -e "ERROR: Please check eslint hints.\n"
    npx eslint -c ${ESLINT_CONF} --ignore-path ${ESLINT_IGNORE}  $( git status --porcelain | awk '$1!="D" {if ($1=="R") { print $4 } else { print $2 }}' | grep -E '(.ts|.js)$' ) -f unix | head -n -2  | awk '{print $NF}' >> "./$LOG_FILE";
    echo -e "Hightest eslint error/warning\n";
    echo -e "times\terror"
    cat "./$LOG_FILE" | sort | uniq -c | sort -rn | head -n 10
    exit 1
fi

echo "Perfect coding format!"
