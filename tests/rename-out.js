"use strict";
var x = "x";
function named_fn(a, b) {
    if (true) {
        console.log(x);
    }

    // let x must be renamed to var x$1 or else it will shadow the reference on line 5
    for (var x$1 = 0; x$1 < 2; x$1++) {
        console.log(x$1);
    }
}
named_fn();
