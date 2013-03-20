"use strict";
var arr = [];

// x is bound once for entire loop so this could actually be transformed
for (let x = 0; x < 10; x++) {
    arr.push(function() { return x; });
}

// fresh y per iteration so can't be transformed
for (var x = 0; x < 10; x++) {
    let y = x;
    arr.push(function() { return y; });
}

/*
// can be transformed (common WAT)
for (var x = 0; x < 10; x++) {
    arr.push(function() { return x; });
}

// fresh x per iteration so can't be transformed
for (let x in [0,1,2]) {
    arr.push(function() { return x; });
}

// can be transformed
for (let x in [0,1,2]) {
    arr.push((function(x) { return function() { return x; } })(x));
}

arr.forEach(function(f) {
    console.log(f());
});
*/
