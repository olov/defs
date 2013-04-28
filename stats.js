const fmt = require("simple-fmt");
const is = require("simple-is");
const assert = require("assert");

function Stats() {
    this.lets = 0;
    this.consts = 0;
    this.renames = [];
}

Stats.prototype.declarator = function(kind) {
    assert(is.someof(kind, ["const", "let"]));
    if (kind === "const") {
        this.consts++;
    } else {
        this.lets++;
    }
};

Stats.prototype.rename = function(oldName, newName, line) {
    this.renames.push({
        oldName: oldName,
        newName: newName,
        line: line,
    });
};

Stats.prototype.toString = function() {
//    console.log("defs.js stats for file {0}:", filename)

    const renames = this.renames.map(function(r) {
        return r;
    }).sort(function(a, b) {
            return a.line - b.line;
        }); // sort a copy of renames

    const renameStr = renames.map(function(rename) {
        return fmt("\nline {0}: {1} => {2}", rename.line, rename.oldName, rename.newName);
    }).join("");

    const constlets = fmt("{0} const/let ratio ({1} consts, {2} lets)",
        (this.consts === 0 && this.lets === 0) ? "n/a" :
            (this.lets === 0 ? "∞" : (this.consts / this.lets).toPrecision(2) + "x"),
        this.consts, this.lets);

    return constlets + renameStr + "\n";
};

module.exports = Stats;
