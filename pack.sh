#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")"
read_version="import sys, json; print(json.load(sys.stdin)['version'])"
ver_value=$(cat manifest.json | python3 -c "$read_version")
ver_date=$(date +.%y%m%d.)

if [[ $ver_value != *$ver_date* ]]; then
    echo "[$ver_value] is not contains: $ver_date"
    read -p "Continue? (y/n)" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        [[ "$0" = "$BASH_SOURCE" ]] && exit 1 || return 1
    fi
fi

out="pack.zip"
self=`basename "$0"`
exclude='.git/\* \*_d.js .gitignore README.md store_assets/\*'
gitignore=$(awk '!/^$/{if ($0 ~ /\/$/) {x="\\*"} else {x=""} printf $0""x" "}' .gitignore)
eval "rm -f $out && zip -r $out . -x $self $exclude $gitignore"
