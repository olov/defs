## v0.4 2013-07-10
 * defs became self aware
 * NPM package includes (and defaults to) the self-transpiled version
 * Bugfix renaming of index-expressions such as `arr[i]` (issue #10)

## v0.3 2013-07-05
 * defs used as a library returns errors collected to `ret.errors` instead
   of writing to stderr. This also deprecates `ret.exitcode`
