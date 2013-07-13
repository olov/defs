# defs.js
Static scope analysis and transpilation of ES6 block scoped `const` and `let`
variables, to ES3.

Node already supports `const` and `let` so you can use that today
(run `node --harmony` and `"use strict"`). `defs.js` enables you to do the same
for browser code. While developing you can rely on the experimental support
in Chrome (chrome://flags, check Enable experimental JavaScript). `defs.js` is
also a pretty decent static scope analyzer/linter.

The talk
[LET's CONST together, right now (with ES3)](http://vimeo.com/66501924)
from Front-Trends 2013
([slides](http://blog.lassus.se/files/lets_const_together_ft2013.pdf)) includes
more information about `let`, `const` and `defs.js`. See also the blog post
[ES3 <3 block scoped const and let => defs.js](http://blog.lassus.se/2013/05/defsjs.html).


## Installation and usage
    npm install -g defs

Then run it as `defs file.js`. The errors (if any) will go to stderr,
the transpiled source to `stdout`, so redirect it like `defs file.js > output.js`.
More command line options are coming.

There's also a [Grunt](http://gruntjs.com/) plugin, see [grunt-defs](https://npmjs.org/package/grunt-defs).

See [BUILD.md](BUILD.md) for a description of the self-build and the browser bundle.

## License
`MIT`, see [LICENSE](LICENSE) file.


## Changes
See [CHANGES.md](CHANGES.md).


## Configuration
`defs` looks for a `defs-config.json` configuration file in your current
directory. It will search for it in parent directories soon as you'd expect.

Example `defs-config.json`:

    {
        "environments": ["node", "browser"],

        "globals": {
            "my": false,
            "hat": true
        },
        "disallowVars": false,
        "disallowDuplicated": true,
        "disallowUnknownReferences": true
    }

`globals` lets you list your program's globals, and indicate whether they are
writable (`true`) or read-only (`false`), just like `jshint`.

`environments` lets you import a set of pre-defined globals, here `node` and
`browser`. These default environments are borrowed from `jshint` (see
[jshint_globals/vars.js](https://github.com/olov/defs/blob/master/jshint_globals/vars.js)).

`disallowVars` (defaults to `false`) can be enabled to make
usage of `var` an error.

`disallowDuplicated` (defaults to `true`) errors on duplicated
`var` definitions in the same function scope.

`disallowUnknownReferences` (defaults to `true`) errors on references to
unknown global variables.

`ast` (defaults to `false`) produces an AST instead of source code
(experimental).

`stats` (defaults to `false`) prints const/let statistics and renames
(experimental).


## Example

Input `example.js`:

```javascript
"use strict";
function fn() {
    const y = 0;
    for (let x = 0; x < 10; x++) {
        const y = x * 2;
        const z = y;
    }
    console.log(y); // prints 0
}
fn();
```

Output from running `defs example.js`:

```javascript
"use strict";
function fn() {
    var y = 0;
    for (var x = 0; x < 10; x++) {
        var y$0 = x * 2;
        var z = y$0;
    }
    console.log(y); // prints 0
}
fn();
```


## defs.js used as a library
`npm install defs`, then:

```javascript
const defs = require("defs");
const options = {};
const res = defs("const x = 1", options);
assert(res.src === "var x = 1");
```

res object:

    {
        src: string // on success
        errors: array of error messages // on errors
        stats: statistics object (toStringable)
        ast: transformed ast // when options.ast is set
    }


## Compatibility
`defs.js` strives to transpile your program as true to the ES6 block scope semantics as
possible, while being as maximally non-intrusive as possible. The only textual
differences you'll find between your original and transpiled program is that the latter
uses `var` and occasional variable renames.


### Loop closures limitation
`defs.js` won't transpile a closure-that-captures-a-block-scoped-variable-inside-a-loop, such
as the following example:

```javascript
for (let x = 0; x < 10; x++) {
    let y = x;
    arr.push(function() { return y; });
}
```

With ES6 semantics `y` is bound fresh per loop iteration, so each closure captures a separate
instance of `y`, unlike if `y` would have been a `var`. [Actually, even `x` is bound per
iteration, but v8 (so node) has an
[open bug](https://code.google.com/p/v8/issues/detail?id=2560) for that].

To transpile this example, an IIFE or `try-catch` must be inserted, which isn't maximally
non-intrusive. `defs.js` will detect this case and spit out an error instead, like so:

    line 3: can't transform closure. y is defined outside closure, inside loop

You need to manually handle this the way we've always done pre-`ES6`,
for instance like so:

```javascript
for (let x = 0; x < 10; x++) {
    (function(y) {
        arr.push(function() { return y; });
    })(x);
}
```

I'm interested in feedback on this based on real-world usage of `defs.js`.


### Referenced (inside closure) before declaration
`defs.js` detects the vast majority of cases where a variable is referenced prior to
its declaration. The one case it cannot detect is the following:

```javascript
function printx() { console.log(x); }
printx(); // illegal
let x = 1;
printx(); // legal
```

The first call to `printx` is not legal because `x` hasn't been initialized at that point
of *time*, which is impossible to catch reliably with statical analysis.
`v8 --harmony` will detect and error on this via run-time checking. `defs.js` will
happily transpile this example (`let` => `var` and that's it), and the transpiled code
will print `undefined` on the first call to `printx`. This difference should be a very
minor problem in practice.
