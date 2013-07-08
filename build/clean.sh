#!/bin/sh
echo "cleaning build files"
rm -f *.js
declare -a cops=(node_modules jshint_globals tests)
for i in ${cops[@]}
do
  rm -rf $i
done
echo "done"
