# defs.js
Static scope analysis and transpilation of ES6 block scoped `const` and `let`
variables, to ES3.

Node already supports `const` and `let` so you can use that today
(run `node --harmony` and `"use strict"`). `defs.js` enables you to do the same
for browser code. While developing you can rely on the experimental support
in Chrome (chrome://flags, check Enable experimental JavaScript). `defs.js` is
also a pretty decent static scope analyzer/linter.

The slides for the talk
[LET's CONST together, right now (with ES3)](http://blog.lassus.se/files/lets_const_together_ft2013.pdf)
from Front-Trends 2013 includes more information about `let`, `const` and `defs.js`.


## Installation and usage
    npm install -g defs

Then run it as `defs file.js`. The errors (if any) will go to stderr,
the transpiled source to `stdout`, so redirect it like `defs file.js > output.js`.
More command line options is coming.


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


## License
`MIT`, see LICENSE file.
