const { spawnPromisified, fixturesPath } = require("./util/util.js");
const { test } = require("node:test");
const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

// Without registerHooks, Amaro falls back to async module.register().
const skip =
	typeof registerHooks !== "function" && "requires module.registerHooks()";
const { match, strictEqual } = require("node:assert");

const otherHook = pathToFileURL(fixturesPath("other-hook.mjs")).href;

const run = (args) =>
	spawnPromisified(process.execPath, ["--no-warnings", ...args]);

for (const mode of ["strip", "transform"]) {
	test(`should apply ${mode} hooks to require() of TypeScript`, async () => {
		const result = await run([
			`--import=./dist/register-${mode}.mjs`,
			fixturesPath("require-ts.js"),
		]);

		strictEqual(result.stderr, "");
		match(result.stdout, /Hello from CommonJS TypeScript! - required/);
		strictEqual(result.code, 0);
	});

	test(`should apply ${mode} hooks to dynamic import() of TypeScript`, async () => {
		const result = await run([
			`--import=./dist/register-${mode}.mjs`,
			"--input-type=module",
			"--eval",
			`await import(${JSON.stringify(pathToFileURL(fixturesPath("esm/esm.ts")).href)});`,
		]);

		strictEqual(result.stderr, "");
		match(result.stdout, /Hello from ESM TypeScript!/);
		strictEqual(result.code, 0);
	});

	test(
		`should compose ${mode} hooks with other registered hooks`,
		{ skip },
		async () => {
			const typescript = await run([
				`--import=./dist/register-${mode}.mjs`,
				`--import=${otherHook}`,
				fixturesPath("hello.ts"),
			]);
			strictEqual(typescript.stderr, "");
			match(typescript.stdout, /Hello, TypeScript!/);
			strictEqual(typescript.code, 0);

			const javascript = await run([
				`--import=${otherHook}`,
				`--import=./dist/register-${mode}.mjs`,
				fixturesPath("hello.js"),
			]);
			strictEqual(javascript.stderr, "");
			match(javascript.stdout, /other hook saw hello\.js/);
			match(javascript.stdout, /Hello, JavaScript!/);
			strictEqual(javascript.code, 0);
		},
	);
}

test("should work from a programmatic bootstrap file", async () => {
	const result = await run([fixturesPath("bootstrap-strip.mjs")]);

	strictEqual(result.stderr, "");
	match(result.stdout, /Hello from ESM TypeScript!/);
	strictEqual(result.code, 0);
});

test("should throw a syntax error from require() of invalid TypeScript", async () => {
	const result = await run([
		"--import=./dist/register-strip.mjs",
		"--eval",
		`require(${JSON.stringify(fixturesPath("invalid-syntax.ts"))});`,
	]);

	strictEqual(result.stdout, "");
	match(result.stderr, /SyntaxError/);
	strictEqual(result.code, 1);
});

test(
	"should map transformed require() stack traces with source maps",
	{ skip },
	async () => {
		const result = await spawnPromisified(process.execPath, [
			"--enable-source-maps",
			"--import=./dist/register-transform.mjs",
			"--eval",
			`require(${JSON.stringify(fixturesPath("stacktrace.ts"))});`,
		]);

		match(result.stderr, /stacktrace.ts:7:9/);
		strictEqual(result.code, 1);
	},
);
