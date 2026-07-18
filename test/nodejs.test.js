const assert = require("node:assert");
const { test } = require("node:test");
const {
	getFirstExpression,
	isRecoverableError,
	isValidSyntax,
	transformModuleSyntax,
} = require("../dist/index.js");

test("should transform module syntax for the Node.js REPL", () => {
	const result = transformModuleSyntax(
		'import { readFile } from "node:fs/promises";\nreadFile("file");',
	);

	assert.strictEqual(result.hadModuleSyntax, true);
	assert.match(result.code, /__nodeREPLDynamicImport/);
	assert.match(result.code, /readFile/);
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
