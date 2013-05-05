"use strict";

const esprima = require("esprima").parse;
const assert = require("assert");
const is = require("simple-is");
const fmt = require("simple-fmt");
const stringmap = require("stringmap");
const stringset = require("stringset");
const alter = require("alter");
const traverse = require("./traverse");
const Scope = require("./scope");
const error = require("./error");
const options = require("./options");
const Stats = require("./stats");
const jshint_vars = require("./jshint_globals/vars.js");


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

function createScopes(node, parent) {
    assert(!node.$scope);

    node.$parent = parent;
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
            node.$parent.$scope.add(node.id.name, "fun", node.id, null);
        }

        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: node.$parent.$scope,
        });

        node.params.forEach(function(param) {
            node.$scope.add(param.name, "param", param, null);
        });

    } else if (node.type === "VariableDeclaration") {
        // Variable declarations names goes in current scope
        assert(isVarConstLet(node.kind));
        node.declarations.forEach(function(declarator) {
            assert(declarator.type === "VariableDeclarator");
            const name = declarator.id.name;
            if (options.disallowVars && node.kind === "var") {
                error(getline(declarator), "var {0} is not allowed (use let or const)", name);
            }
            node.$scope.add(name, node.kind, declarator.id, declarator.range[1]);
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

    } else if (node.type === "CatchClause") {
        const identifier = node.param;

        node.$scope = new Scope({
            kind: "catch-block",
            node: node,
            parent: node.$parent.$scope,
        });
        node.$scope.add(identifier.name, "caught", identifier, null);

        // All hoist-scope keeps track of which variables that are propagated through,
        // i.e. an reference inside the scope points to a declaration outside the scope.
        // This is used to mark "taint" the name since adding a new variable in the scope,
        // with a propagated name, would change the meaning of the existing references.
        //
        // catch(e) is special because even though e is a variable in its own scope,
        // we want to make sure that catch(e){let e} is never transformed to
        // catch(e){var e} (but rather var e$0). For that reason we taint the use of e
        // in the closest hoist-scope, i.e. where var e$0 belongs.
        node.$scope.closestHoistScope().markPropagates(identifier.name);
    }
}

function createTopScope(programScope, environments, globals) {
    function inject(obj) {
        for (let name in obj) {
            const writeable = obj[name];
            const kind = (writeable ? "var" : "const");
            if (topScope.hasOwn(name)) {
                topScope.remove(name);
            }
            topScope.add(name, kind, {loc: {start: {line: -1}}}, -1);
        }
    }

    const topScope = new Scope({
        kind: "hoist",
        node: {},
        parent: null,
    });

    const complementary = {
        undefined: false,
        Infinity: false,
        console: false,
    };

    inject(complementary);
    inject(jshint_vars.reservedVars);
    inject(jshint_vars.ecmaIdentifiers);
    if (environments) {
        environments.forEach(function(env) {
            if (!jshint_vars[env]) {
                error(-1, 'environment "{0}" not found', env);
            } else {
                inject(jshint_vars[env]);
            }
        });
    }
    if (globals) {
        inject(globals);
    }

    // link it in
    programScope.parent = topScope;
    topScope.children.push(programScope);

    return topScope;
}

function setupReferences(ast, allIdentifiers) {
    function visit(node) {
        if (!isReference(node)) {
            return;
        }
        allIdentifiers.add(node.name);

        const scope = node.$scope.lookup(node.name);
        if (!scope && options.disallowUnknownReferences) {
            error(getline(node), "reference to unknown global variable {0}", node.name);
        }
        // check const and let for referenced-before-declaration
        if (scope && is.someof(scope.getKind(node.name), ["const", "let"])) {
            const allowedFromPos = scope.getFromPos(node.name);
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
    }

    traverse(ast, {pre: visit});
}

// TODO for loops init and body props are parallel to each other but init scope is outer that of body
// TODO is this a problem?

function varify(ast, stats, allIdentifiers) {
    const changes = [];

    function unique(name) {
        assert(allIdentifiers.has(name));
        for (let cnt = 0; ; cnt++) {
            const genName = name + "$" + String(cnt);
            if (!allIdentifiers.has(genName)) {
                return genName;
            }
        }
    }

    function renameDeclarations(node) {
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

                stats.declarator(node.kind);

                // rename if
                // 1) name already exists in hoistScope, or
                // 2) name is already propagated (passed) through hoistScope or manually tainted
                const rename = (origScope !== hoistScope &&
                    (hoistScope.hasOwn(name) || hoistScope.doesPropagate(name)));

                const newName = (rename ? unique(name) : name);

                origScope.remove(name);
                hoistScope.add(newName, "var", declarator.id, declarator.range[1]);

                origScope.moves = origScope.moves || stringmap();
                origScope.moves.set(name, {
                    name: newName,
                    scope: hoistScope,
                });

                allIdentifiers.add(newName);

                if (newName !== name) {
                    stats.rename(name, newName, getline(declarator));

                    declarator.id.originalName = name;
                    declarator.id.name = newName;

                    // textchange var x => var x$1
                    changes.push({
                        start: declarator.id.range[0],
                        end: declarator.id.range[1],
                        str: newName,
                    });
                }
            });
        }
    }

    function renameReferences(node) {
        if (!node.$refToScope) {
            return;
        }
        const move = node.$refToScope.moves && node.$refToScope.moves.get(node.name);
        if (!move) {
            return;
        }
        node.$refToScope = move.scope;

        if (node.name !== move.name) {
            node.originalName = node.name;
            node.name = move.name;

            changes.push({
                start: node.range[0],
                end: node.range[1],
                str: move.name,
            });
        }
    }

    traverse(ast, {pre: renameDeclarations});
    traverse(ast, {pre: renameReferences});
    ast.$scope.traverse({pre: function(scope) {
        delete scope.moves;
    }});

    return changes;
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

function run(src, config) {
    // alter the options singleton with user configuration
    for (let key in config) {
        options[key] = config[key];
    }

    const ast = esprima(src, {
        loc: true,
        range: true,
    });

    // TODO detect unused variables (never read)
    error.reset();

    // setup scopes
    traverse(ast, {pre: createScopes});
    const topScope = createTopScope(ast.$scope, options.environments, options.globals);

    // allIdentifiers contains all declared and referenced vars
    // collect all declaration names (including those in topScope)
    const allIdentifiers = stringset();
    topScope.traverse({pre: function(scope) {
        allIdentifiers.addMany(scope.decls.keys());
    }});

    // setup node.$refToScope, check for errors.
    // also collects all referenced names to allIdentifiers
    setupReferences(ast, allIdentifiers);

    // static analysis passes
    traverse(ast, {pre: detectLoopClosuresPre, post: detectLoopClosuresPost});
    traverse(ast, {pre: detectConstAssignment});
    //detectConstantLets(ast);

    //ast.$scope.print(); process.exit(-1);

    if (error.any) {
        return {
            exitcode: -1,
        };
    }

    // change constlet declarations to var, renamed if needed
    // varify modifies the scopes and AST accordingly and
    // returns a list of change fragments (to use with alter)
    const stats = new Stats();
    const changes = varify(ast, stats, allIdentifiers);

    if (options.ast) {
        // return the modified AST instead of src code
        // get rid of all added $ properties first, such as $parent and $scope
        traverse(ast, {cleanup: true});
        return {
            exitcode: 0,
            stats: stats,
            ast: ast,
        };
    } else {
        // apply changes produced by varify and return the transformed src
        const transformedSrc = alter(src, changes);
        return {
            exitcode: 0,
            stats: stats,
            src: transformedSrc,
        };
    }
}

module.exports = run;
