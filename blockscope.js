"use strict";

const esprima = require("esprima").parse;
const fs = require("fs");
const assert = require("assert");
const is = require("./lib/is");
const fmt = require("./lib/fmt");
const traverse = require("./traverse");
const Scope = require("./scope");
const alter = require("./alter");

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

function constLet(t) {
    return is.someof(t, ["const", "let"]);
}

function varConstLet(t) {
    return is.someof(t, ["var", "const", "let"]);
}

function isNonFunctionBlock(node) {
    return node.type === "BlockStatement" && is.noneof(node.$parent.type, ["FunctionDeclaration", "FunctionExpression"]);
}

function isForWithConstLet(node) {
    return node.type === "ForStatement" && node.init && node.init.type === "VariableDeclaration" && constLet(node.init.kind);
}

function isForInWithConstLet(node) {
    return node.type === "ForInStatement" && node.left.type === "VariableDeclaration" && constLet(node.left.kind);
}

function isFunction(node) {
    return is.someof(node.type, ["FunctionDeclaration", "FunctionExpression"]);
}

function isReference(node) {
    return node.type === "Identifier" &&
        !(node.$parent.type === "VariableDeclarator" && node.$parent.id === node) && // var|let|const $
        !(node.$parent.type === "MemberExpression" && node.$parent.property === node) && // obj.$
        !(node.$parent.type === "Property" && node.$parent.key === node) && // {$: ...}
        !(node.$parent.type === "LabeledStatement" && node.$parent.label === node) && // $: ...
        !(node.$parent.type === "CatchClause" && node.$parent.param === node) && // catch($)
        !(isFunction(node.$parent) && node.$parent.id === node) && // function $(..
        !(isFunction(node.$parent) && is.someof(node, node.$parent.params)) && // function f($)..
        true;
}

function createScopes(node) {
    node.$scope = node.$parent ? node.$parent.$scope : null; // may be overridden

    if (node.type === "Program") {
        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: null,
        });

    } else if (isFunction(node)) {
        if (node.id) {
            assert(node.type === "FunctionDeclaration"); // no support for named function expressions yet
            assert(node.id.type === "Identifier");
            node.$parent.$scope.add(node.id.name, "fun");
        }

        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: node.$parent.$scope,
        });

        node.params.forEach(function(param) {
            node.$scope.add(param.name, "param");
        });

    } else if (node.type === "VariableDeclaration") {
        assert(varConstLet(node.kind));
        node.declarations.forEach(function(declarator) {
            assert(declarator.type === "VariableDeclarator");
            node.$scope.add(declarator.id.name, node.kind);
        });

    } else if (isNonFunctionBlock(node) || isForWithConstLet(node) || isForInWithConstLet(node)) {
        node.$scope = new Scope({
            kind: "block",
            node: node,
            parent: node.$parent.$scope,
        });

    } else {
        // TODO catch(e)
    }
}

function setupReferences(node) {
    if (!isReference(node)) {
        return;
    }
    node.$references = node.$scope.lookup(node.name);
//    console.log(fmt("line {0}, col {1}: {2} - {3}", node.loc.start.line, node.loc.start.column, node.name, node.$references && node.$references.node.type));
}

// TODO make robust
let cnt = 0;
function unique(name) {
    return name + "$" + String(++cnt);
}

/*
Change all let and const declarations to var
optionally rename:
  if name is already present in hoisted scope
  if name is a reference that would otherwise get shadowed
add name to hoisted scope
remove name from
 */

// TODO for loops init and body props are parallell to each other but init scope is outer that of body
// TODO is this a problem?
const changes = [];
function convertConstLets(node) {
    if (node.type === "VariableDeclaration" && constLet(node.kind)) {
        const hoistScope = node.$scope.closestHoistScope();
        const origScope = node.$scope;

        // text change const|let => var
        changes.push({
            start: node.range[0],
            end: node.range[0] + node.kind.length,
            str: "var",
        });

        node.declarations.forEach(function(declaration) {
            assert(declaration.type === "VariableDeclarator");

            const name = declaration.id.name;

            let rename = false;
            traverse(hoistScope.node, {pre: function(node) {
                if (node.$references &&
                    node.name === name &&
                    node.$references !== origScope &&
                    hoistScope.isInnerScopeOf(node.$references)) {
//                        console.log("rename due to shadowing: " + name);
                    rename = true;
                }
            }});

            if (origScope !== hoistScope && hoistScope.hasOwn(name)) {
                rename = true;
            }

            origScope.remove(name);
            const newName = (rename ? unique(name) : name);
            hoistScope.add(newName, "var");

            // textchange var x => var x$1
            if (newName !== name) {
                changes.push({
                    start: declaration.id.range[0],
                    end: declaration.id.range[1],
                    str: newName,
                });
            }

            traverse(node.$parent, {pre: function(node) {
                if (node.$references === origScope && node.name === name) {
//                    console.log(fmt("updated ref for {0} to {1}", node.name, newName));

                    node.$references = hoistScope;

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

traverse(ast, {pre: createScopes});
traverse(ast, {pre: setupReferences});
traverse(ast, {pre: convertConstLets});

const rootScope = ast.$scope;
//rootScope.print();
//console.dir(rootScope);

const transformedSrc = alter(src, changes)
process.stdout.write(transformedSrc);

//console.dir(ast);

function srcFor(node) {
    return src.slice(node.range[0], node.range[1]);
}
