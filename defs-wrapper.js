"use strict";

const fs = require("fs");
const fmt = require("simple-fmt");
const tryor = require("tryor");
const defs = require("./defs-main");

if (process.argv.length <= 2) {
    console.log("USAGE: defs file.js");
    process.exit(-1);
}
const filename = process.argv[2];

if (!fs.existsSync(filename)) {
    console.log(fmt("error: file not found <{0}>", filename));
    process.exit(-1);
}

const src = String(fs.readFileSync(filename));

const config = tryor(function() {
    return JSON.parse(String(fs.readFileSync("defs-config.json")));
}, {});

const ret = defs(src, config);
if (ret.exitcode !== 0) {
    process.exit(ret.exitcode);
}

if (ret.ast) {
    process.stdout.write(JSON.stringify(ret.ast, null, 4));
}
if (ret.src) {
    process.stdout.write(ret.src);
}
