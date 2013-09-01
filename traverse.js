"use strict";

function traverse(root, options) {
    options = options || {};
    var pre = options.pre;
    var post = options.post;

    function visit(node, parent) {
        if (!node || typeof node.type !== "string") {
            return;
        }

        var res = undefined;
        if (pre) {
            res = pre(node, parent);
        }

        if (res !== false) {
            for (var prop in node) {
                if (prop[0] === "$") {
                    continue;
                }

                var child = node[prop];

                if (Array.isArray(child)) {
                    for (var i = 0; i < child.length; i++) {
                        visit(child[i], node);
                    }
                } else {
                    visit(child, node);
                }
            }
        }

        if (post) {
            post(node, parent);
        }
    }

    visit(root, null);
};
module.exports = traverse;
