#!/bin/sh
echo "beginning defs self-build"
rm -rf es5
mkdir es5

declare -a files=(defs-main.js defs-wrapper.js error.js options.js run-tests.js scope.js stats.js traverse.js)
for i in ${files[@]}
do
  echo "building $i"
  node --harmony ../defs-wrapper ../$i > es5/$i
done

cp defs es5/
cp -r ../jshint_globals es5/

cd es5

echo "running tests (in es5 mode i.e. without --harmony)"
/usr/bin/env node run-tests.js es5
echo "done self-build"
