#!/bin/sh

grep -Re  '\"activation\"\:false\,\"branch\":\"RESTART\"' ./ | sort -rn > ../result
