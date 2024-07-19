const { test } = require("node:test");
const assert = require("node:assert");
const { transformSync } = require("../dist/index.js");

test("should perform type stripping", () => {
	assert.strictEqual(typeof transformSync, "function");
	const { code } = transformSync("const foo: string = 'bar';");
	assert.strictEqual(code, "const foo         = 'bar';");
});
