"use strict";

const is = require("./lib/is");

function traverse(root, options) {
    options = options || {};
    const pre = options.pre;
    const post = options.post;

    function visit(node, parent) {
        if (!node || !is.string(node.type)) {
            return;
        }

        if (!is.in(node, "$parent")) {
            node.$parent = parent;
        }

        let res = undefined;
        if (pre) {
            res = pre(node);
        }

        if (res !== false) {
            for (let prop in node) {
                if (prop[0] === "$") {
                    continue;
                }

                var child = node[prop];

                if (Array.isArray(child)) {
                    for (let i = 0; i < child.length; i++) {
                        visit(child[i], node);
                    }
                } else {
                    visit(child, node);
                }
            }
        }

        if (post) {
            post(node);
        }
    }

    visit(root, null);
};
module.exports = traverse;
