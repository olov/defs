"use strict";

const assert = require("assert");
const stringmap = require("./lib/stringmap");
const is = require("./lib/is");
const error = require("./error");
const config = require("./config");

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
    this.poses = stringmap();

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

Scope.prototype.add = function(name, kind, node, referableFromPos) {
    // TODO catch-param
    assert(is.someof(kind, ["fun", "param", "var", "const", "let"]));

    function isConstLet(kind) {
        return is.someof(kind, ["const", "let"]);
    }

    let scope = this;

    // const|let variables go directly in the scope (could be block or hoist)
    // others go in the nearest hoist-scope
    //
    if (!isConstLet(kind)) {
        while (scope.kind === "block") {
            if (scope.names.has(name)) {
                assert(is.someof(scope.names.get(name), ["const", "let"]));
                return error(node.loc.start.line, "{0} is already declared", name);
            }
            scope = scope.parent;
        }
    }
    // name exists in scope and either new or existing kind is const|let => error
    if (scope.names.has(name) && (config.disallowDuplicated || isConstLet(scope.names.get(name)) || isConstLet(kind))) {
        return error(node.loc.start.line, "{0} is already declared", name);
    }
    scope.names.set(name, kind);
    scope.poses.set(name, referableFromPos);
};

Scope.prototype.getKind = function(name) {
    assert(is.string(name));
    return this.names.get(name);
};

Scope.prototype.getPos = function(name) {
    assert(is.string(name));
    return this.poses.get(name);
};

Scope.prototype.remove = function(name) {
    assert(is.string(name));
    assert(this.names.has(name));
    this.names.delete(name);
    this.poses.delete(name);
};

Scope.prototype.hasOwn = function(name) {
    return this.names.has(name);
};

Scope.prototype.closestHoistScope = function() {
    let scope = this;
    while (scope.kind !== "hoist") {
        scope = scope.parent;
    }
    return scope;
};

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
