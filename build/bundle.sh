#!/bin/sh
echo "building before creating bundle"
./build.sh
echo "creating defs_bundle.js via browserify"
browserify -r "./defs-main" > defs_bundle.js
echo "done"
