"use strict";

const esprima = require("esprima").parse;
const fs = require("fs");
const assert = require("assert");
const is = require("./lib/is");
const fmt = require("./lib/fmt");
const stringset = require("./lib/stringset");
const traverse = require("./traverse");
const Scope = require("./scope");
const alter = require("./alter");
const error = require("./error");
const config = require("./config");

if (process.argv.length <= 2) {
    console.log("USAGE: node --harmony blockscope.js file.js");
    process.exit(-1);
}
const filename = process.argv[2];

if (!fs.existsSync(filename)) {
    console.log(fmt("error: file not found <{0}>", filename));
    process.exit(-1);
}

const src = String(fs.readFileSync(filename));
const ast = esprima(src, {
    loc: true,
    range: true,
});
const allIdenfitiers = stringset();

function getline(node) {
    return node.loc.start.line;
}

function isConstLet(kind) {
    return is.someof(kind, ["const", "let"]);
}

function isVarConstLet(kind) {
    return is.someof(kind, ["var", "const", "let"]);
}

function isNonFunctionBlock(node) {
    return node.type === "BlockStatement" && is.noneof(node.$parent.type, ["FunctionDeclaration", "FunctionExpression"]);
}

function isForWithConstLet(node) {
    return node.type === "ForStatement" && node.init && node.init.type === "VariableDeclaration" && isConstLet(node.init.kind);
}

function isForInWithConstLet(node) {
    return node.type === "ForInStatement" && node.left.type === "VariableDeclaration" && isConstLet(node.left.kind);
}

function isFunction(node) {
    return is.someof(node.type, ["FunctionDeclaration", "FunctionExpression"]);
}

function isLoop(node) {
    return is.someof(node.type, ["ForStatement", "ForInStatement", "WhileStatement", "DoWhileStatement"]);
}

function isReference(node) {
    return node.$refToScope ||
        node.type === "Identifier" &&
        !(node.$parent.type === "VariableDeclarator" && node.$parent.id === node) && // var|let|const $
        !(node.$parent.type === "MemberExpression" && node.$parent.property === node) && // obj.$
        !(node.$parent.type === "Property" && node.$parent.key === node) && // {$: ...}
        !(node.$parent.type === "LabeledStatement" && node.$parent.label === node) && // $: ...
        !(node.$parent.type === "CatchClause" && node.$parent.param === node) && // catch($)
        !(isFunction(node.$parent) && node.$parent.id === node) && // function $(..
        !(isFunction(node.$parent) && is.someof(node, node.$parent.params)) && // function f($)..
        true;
}

function isLvalue(node) {
    return isReference(node) &&
        ((node.$parent.type === "AssignmentExpression" && node.$parent.left === node) ||
            (node.$parent.type === "UpdateExpression" && node.$parent.argument === node));
}

function addToScope(scope, name, kind, node, referableFromPos) {
    allIdenfitiers.add(name);
    scope.add(name, kind,node, referableFromPos);
}

function createScopes(node) {
    node.$scope = node.$parent ? node.$parent.$scope : null; // may be overridden

    if (node.type === "Program") {
        // Top-level program is a scope
        // There's no block-scope under it
        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: null,
        });

    } else if (isFunction(node)) {
        // Function is a scope, with params in it
        // There's no block-scope under it
        // Function name goes in parent scope
        if (node.id) {
//            if (node.type === "FunctionExpression") {
//                console.dir(node.id);
//            }
//            assert(node.type === "FunctionDeclaration"); // no support for named function expressions yet

            assert(node.id.type === "Identifier");
            addToScope(node.$parent.$scope, node.id.name, "fun", node.id, null); //, node.body.range[0]);
        }

        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: node.$parent.$scope,
        });

        node.params.forEach(function(param) {
            addToScope(node.$scope, param.name, "param", param, -1);
        });

    } else if (node.type === "VariableDeclaration") {
        // Variable declarations names goes in current scope
        assert(isVarConstLet(node.kind));
        node.declarations.forEach(function(declarator) {
            assert(declarator.type === "VariableDeclarator");
            const name = declarator.id.name;
            if (config.disallowVars && node.kind === "var") {
                error(getline(declarator), "var {0} is not allowed (use let or const)", name);
            }
            addToScope(node.$scope, name, node.kind, declarator.id, declarator.range[1]);
        });

    } else if (isForWithConstLet(node) || isForInWithConstLet(node)) {
        // For(In) loop with const|let declaration is a scope, with declaration in it
        // There may be a block-scope under it
        node.$scope = new Scope({
            kind: "block",
            node: node,
            parent: node.$parent.$scope,
        });

    } else if (isNonFunctionBlock(node)) {
        // A block node is a scope unless parent is a function
        node.$scope = new Scope({
            kind: "block",
            node: node,
            parent: node.$parent.$scope,
        });

    } else {
        // TODO catch(e)
    }
}

function createTopScope(programScope) {
    function inject(obj) {
        for (let name in obj) {
            const writeable = obj[name];
            const existingKind = topScope.getKind(name);
            const kind = (writeable ? "var" : "const");
            if (existingKind) {
                if (existingKind !== kind) {
                    error(-1, "global variable {0} writeable and read-only clash", name);
                }
            } else {
                addToScope(topScope, name, kind, {loc: {start: {line: -1}}}, -1);
            }
        }
    }

    const topScope = new Scope({
        kind: "hoist",
        node: {},
        parent: null,
    });

    inject({undefined: false});

    if (fs.existsSync("blockscope-config.json")) {
        const vars = require("./jshint_globals/vars.js");
        const config = {};
        const configJson = JSON.parse(String(fs.readFileSync("blockscope-config.json")));
        configJson.readonly.forEach(function(name) {
            config[name] = false;
        });
        configJson.writeable.forEach(function(name) {
            config[name] = true;
        });
        inject(config);

        const standards = configJson.standards;
        standards.forEach(function(standard) {
            assert(vars[standard]);
            inject(vars[standard]);
        })
    }

    programScope.parent = topScope;
}

function setupReferences(node) {
    if (!isReference(node)) {
        return;
    }
    const scope = node.$scope.lookup(node.name);
    if (!scope && config.disallowUnknownReferences) { // TODO smarter globals support
        error(getline(node), "reference to unknown global variable {0}", node.name);
    }
    if (scope) {
        const allowedFromPos = scope.getPos(node.name);
        const referencedAtPos = node.range[0];
        assert(is.finitenumber(allowedFromPos));
        assert(is.finitenumber(referencedAtPos));
        if (referencedAtPos < allowedFromPos) {
            if (!node.$scope.hasFunctionScopeBetween(scope)) {
                error(getline(node), "{0} is referenced before its declaration", node.name);
            }
        }
    }
    node.$refToScope = scope;
    allIdenfitiers.add(node.name);
}

function unique(name) {
    assert(allIdenfitiers.has(name));
    for (let cnt = 0; ; cnt++) {
        const genName = name + "$" + String(cnt);
        if (!allIdenfitiers.has(genName)) {
            return genName;
        }
    }
}

/*
Change all let and const declarations to var
optionally rename:
  if name is already present in hoisted scope
  if name is a reference that would otherwise get shadowed
add name to hoisted scope
remove name from
 */

// TODO for loops init and body props are parallel to each other but init scope is outer that of body
// TODO is this a problem?
const changes = [];
function convertConstLets(node) {
    if (node.type === "VariableDeclaration" && isConstLet(node.kind)) {
        const hoistScope = node.$scope.closestHoistScope();
        const origScope = node.$scope;

        // text change const|let => var
        changes.push({
            start: node.range[0],
            end: node.range[0] + node.kind.length,
            str: "var",
        });

        node.declarations.forEach(function(declarator) {
            assert(declarator.type === "VariableDeclarator");

            const name = declarator.id.name;

            // rename to avoid shadowing existing references to other variable with the same name
            let rename = false;
            traverse(hoistScope.node, {pre: function(node) {
                if (isReference(node) &&
                    node.$refToScope !== origScope &&
                    node.name === name &&
                    hoistScope.isInnerScopeOf(node.$refToScope)) {
//                        console.log("rename due to shadowing: " + name);
                    rename = true;
                }
            }});

            // rename due to the name being occupied in the hoisted scope (i.e. const|let used to shadow)
            if (origScope !== hoistScope && hoistScope.hasOwn(name)) {
                rename = true;
            }

            origScope.remove(name);
            const newName = (rename ? unique(name) : name);
            addToScope(hoistScope, newName, "var", declarator.id, declarator.range[1]);

            // textchange var x => var x$1
            if (newName !== name) {
                changes.push({
                    start: declarator.id.range[0],
                    end: declarator.id.range[1],
                    str: newName,
                });
            }

            // updated all existing references to the variable
            // TODO is node.$parent sufficient (considering for loop init not parent of body)?
            traverse(node.$parent, {pre: function(node) {
                if (node.$refToScope === origScope && node.name === name) {
//                    console.log(fmt("updated ref for {0} to {1}", node.name, newName));

                    node.$refToScope = hoistScope;

                    // textchange reference x => x$1
                    if (node.name !== newName) {
                        node.name = newName;
                        changes.push({
                            start: node.range[0],
                            end: node.range[1],
                            str: newName,
                        });
                    }
                }
            }});
        });
//        console.log(srcFor(node));
    }
}

let outermostLoop = null;
let functions = [];
function detectLoopClosuresPre(node) {
    if (outermostLoop === null && isLoop(node)) {
        outermostLoop = node;
    }
    if (!outermostLoop) {
        // not inside loop
        return;
    }

    // collect function-chain (as long as we're inside a loop)
    if (isFunction(node)) {
        functions.push(node);
    }
    if (functions.length === 0) {
        // not inside function
        return;
    }

    if (isReference(node) && isConstLet(node.$refToScope.getKind(node.name))) {
        let n = node.$refToScope.node;

        // node is an identifier
        // scope refers to the scope where the variable is defined
        // loop ..-> function ..-> node

        let ok = true;
        while (n) {
//            n.print();
//            console.log("--");
            if (n === functions[functions.length - 1]) {
                // we're ok (function-local)
                break;
            }
            if (n === outermostLoop) {
                // not ok (between loop and function)
                ok = false;
                break;
            }
//            console.log("# " + scope.node.type);
            n = n.$parent;
//            console.log("# " + scope.node);
        }
        if (ok) {
//            console.log("ok loop + closure: " + node.name);
        } else {
            error(getline(node), "can't transform closure. {0} is defined outside closure, inside loop", node.name);
        }


        /*
        walk the scopes, starting from innermostFunction, ending at outermostLoop
        if the referenced scope is somewhere in-between, then we have an issue
        if the referenced scope is inside innermostFunction, then no problem (function-local const|let)
        if the referenced scope is outside outermostLoop, then no problem (const|let external to the loop)

         */
    }
}

function detectLoopClosuresPost(node) {
    if (outermostLoop === node) {
        outermostLoop = null;
    }
    if (isFunction(node)) {
        functions.pop();
    }
}

function detectConstAssignment(node) {
    if (isLvalue(node)) {
        const scope = node.$scope.lookup(node.name);
        if (scope && scope.getKind(node.name) === "const") {
            error(getline(node), "can't assign to const variable {0}", node.name);
        }
    }
}

function detectConstantLets(ast) {
    traverse(ast, {pre: function(node) {
        if (isLvalue(node)) {
            const scope = node.$scope.lookup(node.name);
            if (scope) {
                scope.markWrite(node.name);
            }
        }
    }});

    ast.$scope.detectUnmodifiedLets();
}


// TODO detect unused variables (never read)

// TODO convertToConstLet (stretch)
// convert var codebase to use const and let

traverse(ast, {pre: createScopes});
createTopScope(ast.$scope);
traverse(ast, {pre: setupReferences});
//ast.$scope.print(); process.exit(-1);
traverse(ast, {pre: detectLoopClosuresPre, post: detectLoopClosuresPost});
traverse(ast, {pre: detectConstAssignment});
//detectConstantLets(ast);
if (error.any) {
    process.exit(-1);
}
traverse(ast, {pre: convertConstLets});


const transformedSrc = alter(src, changes)
process.stdout.write(transformedSrc);

//console.dir(ast);

function srcFor(node) {
    return src.slice(node.range[0], node.range[1]);
}
