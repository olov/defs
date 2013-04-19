"use strict";

const assert = require("assert");
const stringmap = require("stringmap");
const stringset = require("stringset");
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
    this.decls = stringmap();
    this.written = stringset();

    if (this.parent) {
        this.parent.children.push(this);
    }
}

Scope.prototype.print = function(indent) {
    indent = indent || 0;
    const scope = this;
    const names = this.decls.keys().map(function(name) {
        return name + " [" + scope.decls.get(name).kind + "]";
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
            if (scope.decls.has(name)) {
                assert(is.someof(scope.decls.get(name).kind, ["const", "let"]));
                return error(node.loc.start.line, "{0} is already declared", name);
            }
            scope = scope.parent;
        }
    }
    // name exists in scope and either new or existing kind is const|let => error
    if (scope.decls.has(name) && (config.disallowDuplicated || isConstLet(scope.decls.get(name).kind) || isConstLet(kind))) {
        return error(node.loc.start.line, "{0} is already declared", name);
    }

    if (kind === "fun" && referableFromPos === null) {
        referableFromPos = scope.node.range[0];
    }

    scope.decls.set(name, {
        kind: kind,
        node: node,
        from: referableFromPos,
    });
};

Scope.prototype.getKind = function(name) {
    assert(is.string(name));
    const decl = this.decls.get(name);
    return decl ? decl.kind : null;
};

Scope.prototype.getNode = function(name) {
    assert(is.string(name));
    const decl = this.decls.get(name);
    return decl ? decl.node : null;
};

Scope.prototype.getFromPos = function(name) {
    assert(is.string(name));
    const decl = this.decls.get(name);
    return decl ? decl.from : null;
};

Scope.prototype.remove = function(name) {
    assert(is.string(name));
    assert(this.decls.has(name));
    this.decls.delete(name);
};

Scope.prototype.hasOwn = function(name) {
    return this.decls.has(name);
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

Scope.prototype.hasFunctionScopeBetween = function(outer) {
    function isFunction(node) {
        return is.someof(node.type, ["FunctionDeclaration", "FunctionExpression"]);
    }

    for (let scope = this; scope; scope = scope.parent) {
        if (scope === outer) {
            return false;
        }
        if (isFunction(scope.node)) {
            return true;
        }
    }

    throw new Error("wasn't inner scope of outer");
};

Scope.prototype.lookup = function(name) {
    for (let scope = this; scope; scope = scope.parent) {
        if (scope.decls.has(name)) {
            return scope;
        }
    }
    return null;
};

Scope.prototype.markWrite = function(name) {
    assert(is.string(name));
    this.written.add(name);
};

// detects let variables that are never modified (ignores top-level)
Scope.prototype.detectUnmodifiedLets = function() {
    const outmost = this;

    function detect(scope) {
        if (scope !== outmost) {
            scope.decls.keys().forEach(function(name) {
                if (scope.getKind(name) === "let" && !scope.written.has(name)) {
                    return error(scope.getNode(name).loc.start.line, "{0} is declared as let but never modified so could be const", name);
                }
            });
        }

        scope.children.forEach(function(childScope) {
            detect(childScope);;
        });
    }
    detect(this);
};


module.exports = Scope;
