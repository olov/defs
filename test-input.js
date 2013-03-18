"use strict";
var x;
function named_fn(a, b) {
    for (x = 3; x < 10; x++) {
        var i = 1;
        let j = 2;
        console.log(x);
    }
    for (let fa in [1,2,3,4,5]) {
        var fb = 3;
        console.log(fa);
    }
    var y,z;
}
named_fn();
