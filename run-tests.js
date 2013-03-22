const fs = require("fs");
const fmt = require("./lib/fmt");
const exec = require("child_process").exec;

function slurp(filename) {
    return fs.existsSync(filename) ? String(fs.readFileSync(filename)) : "";
}

const tests = fs.readdirSync("tests").filter(function(filename) {
    return !/-out\.js$/.test(filename) && !/-stderr$/.test(filename);
});

function run(test) {
    const noSuffix = test.slice(0, -3);
    exec(fmt("node --harmony blockscope tests/{0}", test), function(error, stdout, stderr) {
        stderr = stderr || "";
        stdout = stdout || "";
        const expectedStderr = slurp(fmt("tests/{0}-stderr", noSuffix));
        const expectedStdout = slurp(fmt("tests/{0}-out.js", noSuffix));

        if (stderr !== expectedStderr) {
            fail("stderr", stderr, expectedStderr);
        }
        if (stdout !== expectedStdout) {
            fail("stdout", stdout, expectedStdout);
        }

        function fail(type, got, expected) {
            console.log(fmt("FAILED test {0}", test));
            console.log(fmt("\nEXPECTED {0}:", type));
            process.stdout.write(expected);
            console.log(fmt("\nGOT {0}:", type));
            process.stdout.write(got);
            console.log("---------------------------\n");
        }
    });
}

tests.forEach(run);
