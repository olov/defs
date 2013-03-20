const fs = require("fs");
const fmt = require("./lib/fmt");
const exec = require("child_process").exec;

function slurp(filename) {
    return fs.existsSync(filename) ? String(fs.readFileSync(filename)) : null;
}

const tests = fs.readdirSync("tests").filter(function(filename) {
    return !/-out\.js$/.test(filename) && !/-stderr$/.test(filename);
});

function run(test) {
    const noSuffix = test.slice(0,-3);
    exec(fmt("node --harmony blockscope tests/{0}", test), function (error, stdout, stderr) {
        if (stderr) {
            if (stderr !== slurp(fmt("tests/{0}-stderr", noSuffix))) {
                console.log(fmt("FAIL stderr {0}", test));
                process.stdout.write(stderr);

                console.log("\nEXPECTED:");
                process.stdout.write(slurp(fmt("tests/{0}-stderr", noSuffix)));
            }
        }
        if (stdout) {
            if (stdout !== slurp(fmt("tests/{0}-out.js", noSuffix))) {
                console.log(fmt("FAIL got stdout {0}", test));
                process.stdout.write(stdout);

                console.log("\nEXPECTED:");
                process.stdout.write(slurp(fmt("tests/{0}-out.js", noSuffix)));
            }
        }
    });
}

tests.forEach(run);
