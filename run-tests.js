const fs = require("fs");
const fmt = require("simple-fmt");
const exec = require("child_process").exec;

function slurp(filename) {
    return fs.existsSync(filename) ? String(fs.readFileSync(filename)) : "";
}

const pathToTests = (fs.existsSync("tests") ? "tests" : "../../tests");

const tests = fs.readdirSync(pathToTests).filter(function(filename) {
    return !/-out\.js$/.test(filename) && !/-stderr$/.test(filename);
});

function run(test) {
    const noSuffix = test.slice(0, -3);
    exec(fmt("{0} {1} defs-wrapper {2}/{3}", NODE, FLAG, pathToTests, test), function(error, stdout, stderr) {
        stderr = stderr || "";
        stdout = stdout || "";
        const expectedStderr = slurp(fmt("{0}/{1}-stderr", pathToTests, noSuffix));
        const expectedStdout = slurp(fmt("{0}/{1}-out.js", pathToTests, noSuffix));

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

const NODE = process.argv[0];
const FLAG = (process.argv[2] === "es5" ? "" : "--harmony");
tests.forEach(run);
