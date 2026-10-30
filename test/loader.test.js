const { spawnPromisified, fixturesPath } = require("./util/util.js");
const { test } = require("node:test");
const { match, doesNotMatch, strictEqual } = require("node:assert");

test("should work as a loader", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("hello.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello, TypeScript!/);
	strictEqual(result.code, 0);
});

test("should not work with enums", async (t) => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("enum.ts"),
	]);

	strictEqual(result.stdout, "");
	match(result.stderr, /UnsupportedSyntaxError/);
	match(
		result.stderr,
		/This syntax is not allowed when `erasableSyntaxOnly` is enabled/,
	);
	strictEqual(result.code, 1);
});

test("should work with enums", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-transform.mjs",
		fixturesPath("enum.ts"),
	]);

	match(result.stdout, /Hello, TypeScript!/);
	strictEqual(result.stderr, "");
	strictEqual(result.code, 0);
});

test("should warn when source maps are disabled", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--import=./dist/register-transform.mjs",
		fixturesPath("stacktrace.ts"),
	]);

	strictEqual(result.stdout, "");
	match(result.stderr, /Source maps are disabled/);
	match(result.stderr, /stacktrace.ts:\d+:\d+/);
	strictEqual(result.code, 1);
});

test("should not warn and accurate stracktrace", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--enable-source-maps",
		"--import=./dist/register-transform.mjs",
		fixturesPath("stacktrace.ts"),
	]);

	doesNotMatch(result.stderr, /Source maps are disabled/);
	strictEqual(result.stdout, "");
	match(result.stderr, /stacktrace.ts:7:9/); // accurate
	strictEqual(result.code, 1);
});

test("should call nextLoader for non-typescript files for striping", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("hello.js"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello, JavaScript!/);
	strictEqual(result.code, 0);
});

test("should call nextLoader for non-typescript files for transform", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-transform.mjs",
		fixturesPath("hello.js"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello, JavaScript!/);
	strictEqual(result.code, 0);
});

test("should throw syntax error for invalid typescript", async (t) => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("invalid-syntax.ts"),
	]);
	strictEqual(result.stdout, "");
	match(result.stderr, /SyntaxError/);
	match(
		result.stderr,
		/Await expressions are only allowed within async functions/,
	);
	strictEqual(result.code, 1);
});

test("should work with commonjs typescript files using strip", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("commonjs.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from CommonJS TypeScript!/);
	strictEqual(result.code, 0);
});

test("should work with commonjs typescript files using transform", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-transform.mjs",
		fixturesPath("commonjs.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from CommonJS TypeScript!/);
	strictEqual(result.code, 0);
});

test("should work with .cts files using strip", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("commonjs.cts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from CommonJS TypeScript \(\.cts\)!/);
	strictEqual(result.code, 0);
});

test("should work with .cts files using transform", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-transform.mjs",
		fixturesPath("commonjs.cts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from CommonJS TypeScript \(\.cts\)!/);
	strictEqual(result.code, 0);
});

test("should work with esm typescript files using strip", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("esm/esm.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from ESM TypeScript!/);
	strictEqual(result.code, 0);
});

test("should work with esm typescript files using transform", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-transform.mjs",
		fixturesPath("esm/esm.ts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from ESM TypeScript!/);
	strictEqual(result.code, 0);
});

test("should work with .mts files using strip", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-strip.mjs",
		fixturesPath("esm.mts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from ESM TypeScript!/);
	strictEqual(result.code, 0);
});

test("should work with .mts files using transform", async () => {
	const result = await spawnPromisified(process.execPath, [
		"--no-warnings",
		"--import=./dist/register-transform.mjs",
		fixturesPath("esm.mts"),
	]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from ESM TypeScript!/);
	strictEqual(result.code, 0);
});
