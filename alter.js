"use strict";

const assert = require("assert");

// orig is a string
// changes is a list of {start: index, end: index, str: string to replace with}
function alter(orig, changes) {
    changes.sort(function(a,b) {
        return a.start - b.start;
    });

    const outs = [];

    let pos = 0;
    for (let i = 0; i < changes.length; i++) {
        const frag = changes[i];

        assert(pos <= frag.start);
        assert(frag.start <= frag.end);
        outs.push(orig.slice(pos, frag.start));
        outs.push(frag.str);
        pos = frag.end;
    }
    if (pos < orig.length) {
        outs.push(orig.slice(pos));
    }

    return outs.join("");
}

module.exports = alter;
