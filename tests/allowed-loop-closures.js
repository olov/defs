"use strict";
var arr = [];

// can be transformed (common WAT)
for (var x = 0; x < 10; x++) {
    arr.push(function() { return x; });
}

// can be transformed (common work-around)
for (let x in [0,1,2]) {
    arr.push((function(x) { return function() { return x; } })(x));
}

// can be transformed
for (let x = 0; x < 3; x++) {(function(){
    let y = 1;
    arr.push(function() { return y; });
}).call(this);}

// can be transformed (added IIFE)
for (let x = 0; x < 3; x++) {
    let y = 1;
    arr.push(function() { return y; });
}

// can be transformed (added IIFE)
for (let x = 0; x < 3; x++) {
    let y = x;
    arr.push(function() { return y; });
}

// can be transformed (but already has IIFE so if possible we shouldn't add another. TODO?)
for (let x = 0; x < 3; x++) {(function(){
    let y = x;
    arr.push(function() { return y; });
}).call(this);}

arr.forEach(function(f) {
    console.log(f());
});


// move to forbidden
// cannot be transformed (due to non-specified ES6 for-loop binding-transfer semantics)
for (let x = 0; x < 3; x++) {
    arr.push(function() { return x; });
}
