"use strict";

const assert = require("assert");
const stringmap = require("stringmap");
const stringset = require("stringset");
const is = require("simple-is");
const fmt = require("simple-fmt");
const error = require("./error");
const options = require("./options");

function Scope(args) {
    assert(is.someof(args.kind, ["hoist", "block", "catch-block"]));
    assert(is.object(args.node));
    assert(args.parent === null || is.object(args.parent));

    // kind === "hoist": function scopes, program scope, injected globals
    // kind === "block": ES6 block scopes
    // kind === "catch-block": catch block scopes
    this.kind = args.kind;

    // the AST node the block corresponds to
    this.node = args.node;

    // parent scope
    this.parent = args.parent;

    // children scopes for easier traversal (populated internally)
    this.children = [];

    // scope declarations. decls[variable_name] = {
    //     kind: "fun" for functions,
    //           "param" for function parameters,
    //           "caught" for catch parameter
    //           "var",
    //           "const",
    //           "let"
    //     node: the AST node the declaration corresponds to
    //     from: source code index from which it is visible at earliest
    // }
    this.decls = stringmap();

    // history of moved variables. moves[old_name] = {
    //     name: new name
    //     scope: new scope
    // }
    // TODO store elsewhere?
    this.moves = stringmap();

    // names of all declarations within this scope that was ever written
    // TODO move to decls.w?
    // TODO create corresponding read?
    this.written = stringset();

    // names of all variables declared outside this hoist scope but
    // referenced in this scope (immediately or in child).
    // only stored on hoist scopes for efficiency
    // (because we currently generate lots of empty block scopes)
    this.propagates = (this.kind === "hoist" ? stringset() : null);

    // scopes register themselves with their parents for easier traversal
    if (this.parent) {
        this.parent.children.push(this);
    }
}

Scope.prototype.print = function(indent) {
    indent = indent || 0;
    const scope = this;
    const names = this.decls.keys().map(function(name) {
        return fmt("{0} [{1}]", name, scope.decls.get(name).kind);
    }).join(", ");
    const propagates = this.propagates ? this.propagates.items().join(", ") : "";
    console.log(fmt("{0}{1}: {2}. propagates: {3}", fmt.repeat(" ", indent), this.node.type, names, propagates));
    this.children.forEach(function(c) {
        c.print(indent + 2);
    });
};

Scope.prototype.add = function(name, kind, node, referableFromPos) {
    assert(is.someof(kind, ["fun", "param", "var", "caught", "const", "let"]));

    function isConstLet(kind) {
        return is.someof(kind, ["const", "let"]);
    }

    let scope = this;

    // search nearest hoist-scope for fun, param and var's
    // const, let and caught variables go directly in the scope (which may be hoist, block or catch-block)
    if (is.someof(kind, ["fun", "param", "var"])) {
        while (scope.kind !== "hoist") {
            if (scope.decls.has(name) && isConstLet(scope.decls.get(name).kind)) { // could be caught
                return error(node.loc.start.line, "{0} is already declared", name);
            }
            scope = scope.parent;
        }
    }
    // name exists in scope and either new or existing kind is const|let => error
    if (scope.decls.has(name) && (options.disallowDuplicated || isConstLet(scope.decls.get(name).kind) || isConstLet(kind))) {
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

Scope.prototype.addGlobal = function(name, kind, node, referableFromPos) {
    assert(is.someof(kind, ["fun", "param", "var", "caught", "const", "let"]));
    assert(this.parent === null);
    this.decls.set(name, {
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

Scope.prototype.move = function(name, newName, newScope) {
    assert(is.string(name));
    assert(is.string(newName));
    assert(this.decls.has(name));
    this.decls.delete(name);
    this.moves.set(name, {
        name: newName,
        scope: newScope,
    });
};

Scope.prototype.getMove = function(name) {
    return this.moves.get(name);
};

Scope.prototype.hasOwn = function(name) {
    return this.decls.has(name);
};

Scope.prototype.doesPropagate = function(name) {
    return this.propagates.has(name);
};

Scope.prototype.markPropagates = function(name) {
    this.propagates.add(name);
};

Scope.prototype.closestHoistScope = function() {
    let scope = this;
    while (scope.kind !== "hoist") {
        scope = scope.parent;
    }
    return scope;
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
        } else if (scope.kind === "hoist") {
            scope.propagates.add(name);
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
