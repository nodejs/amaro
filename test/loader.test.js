const { spawnPromisified, fixturesPath } = require("./util/util.js");
const { test } = require("node:test");
const { match, strictEqual } = require("node:assert");

test("should work as a loader", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--experimental-strip-types",
		"--no-warnings",
		"--import=./dist/index.js",
		fixturesPath("hello.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello, TypeScript!/);
	strictEqual(result.code, 0);
});

test("should work with enums", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--experimental-strip-types",
		"--no-warnings",
		"--import=./dist/index.js",
		fixturesPath("enum.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello, TypeScript!/);
	strictEqual(result.code, 0);
});
