const esprima = require("esprima").parse;
const fs = require("fs");
const traverse = require("./traverse");

const src = fs.readFileSync("test-input.js");
const ast = esprima(src, {
    loc: true,
    range: true,
});

traverse(ast, {pre: function(n) {
    console.log(n.type);
}});
//console.dir(ast);
