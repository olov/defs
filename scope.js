"use strict";

const assert = require("assert");
const stringmap = require("./lib/stringmap");
const is = require("./lib/is");
const error = require("./error");

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
    const scope = this;
    const names = this.names.keys().map(function(name) {
        return name + " [" + scope.names.get(name) + "]";
    }).join(", ");
    console.log(spaces(indent) + this.node.type + ": " + names);
    this.children.forEach(function(c) {
        c.print(indent + 2);
    });
};

Scope.prototype.add = function(name, kind, node) {
    // TODO catch-param
    assert(is.someof(kind, ["fun", "param", "var", "const", "let"]));

    const isntConstLet = is.noneof(kind, ["const", "let"]);
    let scope = this;

    if (isntConstLet) {
        while (scope.kind !== "hoist") {
            if (scope.names.has(name)) {
                return error(node.loc.start.line, "{0} is already declared", name);
            }
            scope = scope.parent;
        }
    }
    if (scope.names.has(name)) {
        return error(node.loc.start.line, "{0} is already declared", name);
    }
    scope.names.set(name, kind);
}

Scope.prototype.remove = function(name) {
    assert(this.names.has(name));
    this.names.delete(name);
}

Scope.prototype.hasOwn = function(name) {
    return this.names.has(name);
}

Scope.prototype.closestHoistScope = function() {
    let scope = this;
    while (scope.kind !== "hoist") {
        scope = scope.parent;
    }
    return scope;
}

Scope.prototype.isInnerScopeOf = function(outer) {
    // TODO handle metaglobal scope differently
    if (outer === null) {
        return true;
    }
    for (let scope = this.parent; scope; scope = scope.parent) {
        if (scope === outer) {
            return true;
        }
    }
    return false;
};

Scope.prototype.lookup = function(name) {
    for (let scope = this; scope; scope = scope.parent) {
        if (scope.names.has(name)) {
            return scope;
        }
    }
    return null;
};

module.exports = Scope;
