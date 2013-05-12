"use strict";

function test1({opt1: opt1, opt2}) {
    {
        var {a :opt1$0, b :opt2$0} = {a: 1, b: 2};
        console.log(opt1$0, opt2$0);
    }
    console.log(opt1, opt2);
}
test1({opt1: 1, opt2: 2});

function test2(obj) {
    var {a, b: bVar} = obj;
    console.log(a, bVar);
}
test2({a: 1, b: 2});

function test3(array) {
    var a = 1, b, b$0;
    {
        var [a$0, , b$1, c] = array;
        console.log(a$0, b$1, c);
    }
    console.log(a, b, b$0);
}
test3([1,null,2,3]);

function test4(array) {
    var [a, , b, , c] = array;
    console.log(a, b, c);
}
test4([1, null, 2, null ,3]);

function test5() {
    var obj = { obj: {a: 1, b: 2, cObj: {test: 3}}, test: "test" };
    var {obj: {a, b, cObj: c}, test: testStr} = obj;

    console.log(a, b, c.test, testStr);
}
test5();