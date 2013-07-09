#!/bin/sh
echo "beginning defs self-build"
rm -rf es5
mkdir es5

declare -a files=(defs-main.js defs-wrapper.js error.js options.js run-tests.js scope.js stats.js traverse.js)
for i in ${files[@]}
do
  echo "building $i"
  ../defs-harmony ../$i > es5/$i
done

cp defs es5/

cd es5

declare -a symlinks=(node_modules jshint_globals tests)
for i in ${symlinks[@]}
do
  echo "symlinking $i"
  ln -s ../../$i $i
done

echo "running tests (in es5 mode i.e. without --harmony)"
/usr/bin/env node run-tests.js es5
echo "done self-build"
