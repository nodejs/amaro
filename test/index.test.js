const { test } = require("node:test");
const assert = require("node:assert");
const { stripTypes } = require("../dist/index.js");

test("should perform type stripping", () => {
	assert.strictEqual(typeof stripTypes, "function");
	assert.strictEqual(
		stripTypes("const foo: string = 'bar';"),
		"const foo         = 'bar';",
	);
});
