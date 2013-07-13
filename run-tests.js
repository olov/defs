const fs = require("fs");
const fmt = require("simple-fmt");
const exec = require("child_process").exec;

function slurp(filename) {
    return fs.existsSync(filename) ? String(fs.readFileSync(filename)).trim() : "";
}

const pathToTests = (fs.existsSync("tests") ? "tests" : "../../tests");

const isHarmonyMode = process.argv[2] === "es6";
const NODE = process.argv[0];
const NODE_FLAG = (process.argv[2] === "es5" ? "" : "--harmony");
const DEFS_FLAG = (isHarmonyMode ? "--harmony" : "");

const tests = fs.readdirSync(pathToTests).filter(function(filename) {
    return !/-out\.js$/.test(filename) && !/-stderr$/.test(filename)
		&& (isHarmonyMode || filename.substr(0, 4) != "es6-")
	;
});

function stringCompare(str1, str2) {
	str1 = str1
		.replace(/((\r\n)|\r|\n)/g, "\n")// Windows/Unix, Unicode/ASCII and IDE line break
		.replace(/\t/g, "    ")// IDE settings
	;
	str2 = str2
		.replace(/((\r\n)|\r|\n)/g, "\n")// Windows/Unix, Unicode/ASCII and IDE line break
		.replace(/\t/g, "    ")// IDE settings
	;
    return str1 == str2;
}

var test;

function run() {
    if(!(test = tests.pop()))return;

    const noSuffix = test.slice(0, -3);
    exec(fmt("{0} {1} defs-wrapper {2}/{3} {4}", NODE, NODE_FLAG, pathToTests, test, DEFS_FLAG), function(error, stdout, stderr) {
        stderr = (stderr || "").trim();
        stdout = (stdout || "").trim();
        const expectedStderr = slurp(fmt("{0}/{1}-stderr", pathToTests, noSuffix));
        const expectedStdout = slurp(fmt("{0}/{1}-out.js", pathToTests, noSuffix));

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
