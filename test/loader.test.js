const { spawnPromisified, fixturesPath } = require("./util/util.js");
const { test } = require("node:test");
const { match, doesNotMatch, strictEqual } = require("node:assert");

test("should work as a loader", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--experimental-strip-types",
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("hello.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello, TypeScript!/);
	strictEqual(result.code, 0);
});

test("should not work with enums", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--experimental-strip-types",
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("enum.ts"),
	]);

	strictEqual(result.stdout, "");
	match(result.stderr, /TypeScript enum is not supported in strip-only mode/);
	strictEqual(result.code, 1);
});

test("should work with enums", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--experimental-strip-types",
		"--no-warnings",
		"--import=./dist/register-transform.mjs",
		fixturesPath("enum.ts"),
	]);

	match(result.stdout, /Hello, TypeScript!/);
	strictEqual(result.stderr, "");
	strictEqual(result.code, 0);
});

test("should warn and inaccurate stracktrace", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--experimental-strip-types",
		"--import=./dist/register-transform.mjs",
		fixturesPath("stacktrace.ts"),
	]);

	strictEqual(result.stdout, "");
	match(result.stderr, /Source maps are disabled/);
	match(result.stderr, /stacktrace.ts:5:7/); // inaccurate
	strictEqual(result.code, 1);
});

test("should not warn and accurate stracktrace", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--experimental-strip-types",
		"--enable-source-maps",
		"--import=./dist/register-transform.mjs",
		fixturesPath("stacktrace.ts"),
	]);

	doesNotMatch(result.stderr, /Source maps are disabled/);
	strictEqual(result.stdout, "");
	match(result.stderr, /stacktrace.ts:4:7/); // accurate
	strictEqual(result.code, 1);
});
