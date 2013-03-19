"use strict";

const assert = require("assert");
const stringmap = require("./lib/stringmap");
const is = require("./lib/is");

function spaces(n) {
    return new Array(n + 1).join(" ");
}

function Scope(args) {
    assert(is.someof(args.kind, ["hoist", "block"]));
    assert(is.object(args.node));
    assert(args.parent === null || is.object(args.parent));

    this.kind = args.kind;
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
    const scope = (is.someof(kind, ["const", "let"]) ? this : this.closestHoistScope());
    scope.names.set(name, kind);
}

Scope.prototype.closestHoistScope = function() {
    let scope = this;
    while (scope.kind !== "hoist") {
        scope = scope.parent;
    }
    return scope;
}

Scope.prototype.lookup = function(name) {
    for (let scope = this; scope; scope = scope.parent) {
        if (scope.names.has(name)) {
            return scope;
        }
    }
    return null;
};

module.exports = Scope;
