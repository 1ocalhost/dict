#!/bin/bash
out="pack.zip"
self=`basename "$0"`
exclude='.git/\* \*_d.js .gitignore README.md'
gitignore=$(awk '!/^$/{if ($0 ~ /\/$/) {x="\\*"} else {x=""} printf $0""x" "}' .gitignore)
eval "rm -f $out && zip -r $out . -x $self $exclude $gitignore"