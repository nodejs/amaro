const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const repl = require("node:repl");
const { PassThrough } = require("node:stream");
const { test } = require("node:test");
const {
	findTopLevelAwaits,
	getFirstExpression,
	isRecoverableError,
	isValidSyntax,
	tokenize,
	transformModuleSyntax,
} = require("../dist/nodejs.js");

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

function validatedImport(specifier, requiredExports) {
	const checks = requiredExports
		.map(
			(name) =>
				`if (!(${JSON.stringify(name)} in m)) throw new SyntaxError(${JSON.stringify(
					`The requested module '${specifier}' does not provide an export named '${name}'`,
				)}); `,
		)
		.join("");
	return `__nodeREPLDynamicImport(${JSON.stringify(specifier)}).then((m) => { ${checks}return m; })`;
}

function execute(source, namespace) {
	return new AsyncFunction(
		"__nodeREPLDynamicImport",
		transformModuleSyntax(source).code,
	)(async () => namespace);
}

test("should transform module syntax for the Node.js REPL", () => {
	const result = transformModuleSyntax(
		'import { readFile } from "node:fs/promises";\nreadFile("file");',
	);

	assert.strictEqual(result.hadModuleSyntax, true);
	assert.match(result.code, /__nodeREPLDynamicImport/);
	assert.match(result.code, /readFile/);
});

test("should declare imported bindings instead of rewriting references", () => {
	assert.deepStrictEqual(transformModuleSyntax('import fs from "node:fs";'), {
		code: `const { default: fs } = await ${validatedImport("node:fs", ["default"])};`,
		hadModuleSyntax: true,
	});
	assert.deepStrictEqual(
		transformModuleSyntax('import { readFile as rf } from "node:fs";\nrf();'),
		{
			code: `const { readFile: rf } = await ${validatedImport("node:fs", ["readFile"])};\nrf();`,
			hadModuleSyntax: true,
		},
	);
	assert.deepStrictEqual(
		transformModuleSyntax('import def, * as ns from "mod";\ndef; ns;'),
		{
			code: `const ns = await ${validatedImport("mod", ["default"])}; const def = ns.default;\ndef; ns;`,
			hadModuleSyntax: true,
		},
	);
	assert.deepStrictEqual(
		transformModuleSyntax('import { "a-b" as c } from "mod";\nc;'),
		{
			code: `const { "a-b": c } = await ${validatedImport("mod", ["a-b"])};\nc;`,
			hadModuleSyntax: true,
		},
	);
});

test("should retain imported bindings across REPL inputs", async () => {
	const server = repl.start({
		input: new PassThrough(),
		output: new PassThrough(),
		terminal: false,
		prompt: "",
	});
	const namespace = { default: 7, value: 11, "a-b": 13 };
	server.context.__nodeREPLDynamicImport = async () => namespace;
	// Arrays come from the REPL's vm context, so copy them into this realm
	// before comparing prototypes with deepStrictEqual.
	const evaluate = (source) =>
		new Promise((resolve, reject) => {
			server.eval(
				`${transformModuleSyntax(source).code}\n`,
				server.context,
				"repl-import-test",
				(error, value) =>
					error
						? reject(error)
						: resolve(Array.isArray(value) ? [...value] : value),
			);
		});
	try {
		await evaluate('import first from "m";');
		assert.strictEqual(await evaluate("first"), 7);
		await evaluate('import { value as second, "a-b" as third } from "m";');
		assert.deepStrictEqual(
			await evaluate("[first, second, third]"),
			[7, 11, 13],
		);
		await evaluate('import another, * as ns from "m";');
		assert.deepStrictEqual(await evaluate("[another, ns.value]"), [7, 11]);
		namespace.value = 17;
		assert.deepStrictEqual(await evaluate("[second, ns.value]"), [11, 17]);
	} finally {
		server.close();
	}
});

test("should preserve bare-call this and lexical shadowing", async () => {
	// A bare call of a destructured binding must not receive the namespace
	// object as `this`, unlike the former `__nodeREPLImport0.call()` rewrite.
	const namespace = {
		call() {
			return this === namespace;
		},
		value: 1,
	};
	const { code } = transformModuleSyntax(
		'import { call, value } from "m";\nconst observed = [call(), (() => { const value = 2; return value; })(), value];',
	);
	const observed = await new AsyncFunction(
		"__nodeREPLDynamicImport",
		`${code}\nreturn observed;`,
	)(async () => namespace);
	assert.deepStrictEqual(observed, [false, 2, 1]);
});

test("should let JavaScript enforce const assignment semantics", async () => {
	for (const assignment of [
		"value = 2",
		"value++",
		"({ value } = { value: 2 })",
	]) {
		await assert.rejects(
			execute(`import { value } from "m";\n${assignment};`, { value: 1 }),
			/Assignment to constant variable\./,
		);
	}
});

test("should keep missing-export validation and handle special export names", async () => {
	await assert.rejects(
		execute('import missing from "m";', {}),
		/does not provide an export named 'default'/,
	);
	await assert.rejects(
		execute('import { missing } from "m";', {}),
		/does not provide an export named 'missing'/,
	);
	const { code } = transformModuleSyntax(
		'import { "a-b" as value, __proto__ as proto } from "m";',
	);
	const result = await new AsyncFunction(
		"__nodeREPLDynamicImport",
		`${code}\nreturn [value, proto];`,
	)(async () => ({ "a-b": 1, ["__proto__"]: 2 }));
	assert.deepStrictEqual(result, [1, 2]);
});

test("should find the first expression at an error column", () => {
	assert.strictEqual(
		getFirstExpression("a(); assert.ok(value); b()", 13),
		"assert.ok(value)",
	);
});

test("should validate syntax", () => {
	assert.strictEqual(isValidSyntax("const value: number = 1"), true);
	assert.strictEqual(isValidSyntax("function foo("), false);
});

test("should detect recoverable syntax errors", () => {
	assert.strictEqual(isRecoverableError("function foo() {"), true);
	assert.strictEqual(isRecoverableError("const value: number = 1"), false);
});

test("should tokenize input for syntax highlighting", () => {
	assert.deepStrictEqual(tokenize("const x = 1; // done"), [
		{ kind: "keyword", start: 0, end: 5 },
		{ kind: "identifier", start: 6, end: 7 },
		{ kind: "punctuator", start: 8, end: 9 },
		{ kind: "number", start: 10, end: 11 },
		{ kind: "punctuator", start: 11, end: 12 },
		{ kind: "comment", start: 13, end: 20 },
	]);
});

test("should find top-level awaits", () => {
	assert.deepStrictEqual(
		findTopLevelAwaits("await 1;\nasync function f() { await 2; }\nawait 3;"),
		[
			{ line: 1, column: 0 },
			{ line: 3, column: 0 },
		],
	);
});

const fixturesDir = path.join(__dirname, "fixtures", "nodejs");
for (const [suite, api] of [
	["tokenize", tokenize],
	["awaits", findTopLevelAwaits],
	["recoverable", isRecoverableError],
]) {
	const dir = path.join(fixturesDir, suite);
	for (const file of fs.readdirSync(dir)) {
		const cases = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
		for (const { source, expected } of cases) {
			test(`${suite}/${file}: ${JSON.stringify(source)}`, () => {
				assert.deepStrictEqual(api(source), expected);
			});
		}
	}
}
