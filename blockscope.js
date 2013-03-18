"use strict";

const esprima = require("esprima").parse;
const fs = require("fs");
const stringmap = require("./lib/stringmap");
const is = require("./lib/is");
const traverse = require("./traverse");
const assert = require("assert");

const src = fs.readFileSync("test-input.js");
const ast = esprima(src, {
    loc: true,
    range: true,
});

function spaces(n) {
    return new Array(n + 1).join(" ");
}

function Scope(args) {
    this.node = args.node;
    this.parent = args.parent;
    this.children = [];
    this.names = stringmap();

    if (this.parent) {
        this.parent.children.push(this);
    }
}
Scope.prototype.print = function(indent) {
    indent = indent || 0;
    console.log(spaces(indent) + this.node.type + ": " + this.names.keys());
    this.children.forEach(function(c) {
        c.print(indent + 2);
    });
};
Scope.prototype.add = function(name, kind) {
    this.names.set(name, kind);
}

traverse(ast, {pre: function(node) {
//    console.log(node.type);

    if (node.type === "Program") {
        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: null,
        });
    } else if (node.type === "FunctionDeclaration") {
        assert(node.id.type === "Identifier");
        node.$parent.$scope.add(node.id.name, "fun");

        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: node.$parent.$scope,
        });

        node.params.forEach(function(param) {
            node.$scope.add(param.name, "param");
        });
    } else if (node.type === "VariableDeclaration") {
        assert(is.someof(node.kind, ["var", "const", "let"]));
        node.$scope = node.$parent.$scope;
        node.declarations.forEach(function(declarator) {
            assert(declarator.type === "VariableDeclarator");
            node.$scope.add(declarator.id.name, node.kind);
        });
    } else if (node.type === "BlockStatement" && is.noneof(node.$parent.type, ["FunctionDeclaration", "FunctionExpression"])) {
        node.$scope = new Scope({
            kind: "block",
            node: node,
            parent: node.$parent.$scope,
        });
    } else {
        node.$scope = node.$parent.$scope;
    }
}});

var rootScope = ast.$scope;
rootScope.print();
//console.dir(rootScope);


//console.dir(ast);
