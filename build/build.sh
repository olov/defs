#!/bin/sh
declare -a files=(defs-main.js defs-wrapper.js error.js options.js run-tests.js scope.js stats.js traverse.js)
for i in ${files[@]}
do
  echo "building $i"
  defs ../$i > $i
done

declare -a cops=(node_modules jshint_globals tests)
for i in ${cops[@]}
do
  echo "copying $i"
  cp -r ../$i .
done

echo "running tests (without --harmony)"
NODE=`which node`
$NODE run-tests.js es5
echo "done"
