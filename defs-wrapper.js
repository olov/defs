"use strict";

const fs = require("fs");
const fmt = require("simple-fmt");
const tryor = require("tryor");
const defs = require("./defs-main");

let fileArgvIndex = 2;
const commandVariables = {};
process.argv.forEach(function(arg, index, array) {
    var nextArg;
    if( arg.indexOf("--") === 0 ) {
        fileArgvIndex++;
        if( (nextArg = array[index + 1]) && nextArg.indexOf("--") !== 0 ) {
            this[arg.substring(2)] = nextArg.indexOf("--") === 0 ? true : nextArg;
        }
        else {
            this[arg.substring(2)] = true;
        }
    }
}, commandVariables);

const filename = process.argv[fileArgvIndex];

if (!filename) {
    console.log("USAGE: defs file.js");
    process.exit(-1);
}

if (!fs.existsSync(filename)) {
    console.log(fmt("error: file not found <{0}>", filename));
    process.exit(-1);
}

const src = String(fs.readFileSync(filename));

const config = tryor(function() {
    return JSON.parse(String(fs.readFileSync("defs-config.json")));
}, {});

const ret = defs(src, config);
if (ret.errors) {
    process.stderr.write(ret.errors.join("\n"));
    process.stderr.write("\n");
    process.exit(-1);
}

if (config.stats) {
    process.stdout.write(ret.stats.toString());
    process.exit(0);
}
if (ret.ast) {
    process.stdout.write(JSON.stringify(ret.ast, null, 4));
}
if (ret.src) {
    process.stdout.write(ret.src);
}
