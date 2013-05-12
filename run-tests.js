const fs = require("fs");
const fmt = require("simple-fmt");
const exec = require("child_process").exec;

function slurp(filename) {
    return fs.existsSync(filename) ? String(fs.readFileSync(filename)).trim() : "";
}

const tests = fs.readdirSync("tests").filter(function(filename) {
    return !/-out\.js$/.test(filename) && !/-stderr$/.test(filename);
});

function stringCompare(str1, str2) {
    str1 = str1.replace(/\n\r/g, "").replace(/\r\n/g, "").replace(/\n/g, "").replace(/\r/g, "").replace(/\t/g, "");
    str2 = str2.replace(/\n\r/g, "").replace(/\r\n/g, "").replace(/\n/g, "").replace(/\r/g, "").replace(/\t/g, "");
    return str1 == str2;
}

function run() {
    if(!(test = tests.pop()))return;

    const noSuffix = test.slice(0, -3);
    exec(fmt("node --harmony defs-wrapper tests/{0}", test), function(error, stdout, stderr) {
        stderr = (stderr || "").trim();
        stdout = (stdout || "").trim();
        const expectedStderr = slurp(fmt("tests/{0}-stderr", noSuffix));
        const expectedStdout = slurp(fmt("tests/{0}-out.js", noSuffix));

        if (!stringCompare(stderr, expectedStderr)) {
            fail("stderr", stderr, expectedStderr);
        }
        if (!stringCompare(stdout, expectedStdout)) {
            fail("stdout", stdout, expectedStdout);
        }

        function fail(type, got, expected) {
            console.log(fmt("FAILED test {0}", test));
            console.log(fmt("\nEXPECTED {0}:", type));
            process.stdout.write(expected);
            console.log(fmt("\nGOT {0}:", type));
            process.stdout.write(got);
            console.log("\n---------------------------\n");
        }
        
        run();//next test
    });
}

run();//next test
