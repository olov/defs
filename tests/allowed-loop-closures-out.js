"use strict";
var arr = [];

// can be transformed (common WAT)
for (var x = 0; x < 10; x++) {
    arr.push(function() { return x; });
}

// can be transformed
for (var x$0 in [0,1,2]) {
    arr.push((function(x) { return function() { return x; } })(x$0));
}

// can be transformed
for (var x$1 = 0; x$1 < 3; x$1++) {(function(){
    var y = 1;
    arr.push(function() { return y; });
}).call(this);}

arr.forEach(function(f) {
    console.log(f());
});
