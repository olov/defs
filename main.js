"use strict";

const fs = require("fs");
const tryor = require("tryor");
const blockscope = require("./blockscope");

if (process.argv.length <= 2) {
    console.log("USAGE: node --harmony main.js file.js");
    process.exit(-1);
}
const filename = process.argv[2];

if (!fs.existsSync(filename)) {
    console.log(fmt("error: file not found <{0}>", filename));
    process.exit(-1);
}

const src = String(fs.readFileSync(filename));

const config = tryor(function() {
    return JSON.parse(String(fs.readFileSync("blockscope-config.json")));
}, {});

const ret = blockscope(src, config);
if (ret.exitcode !== 0) {
    process.exit(ret.exitcode);
}

process.stdout.write(ret.src);
