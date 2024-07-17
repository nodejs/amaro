const { test } = require("node:test");
const assert = require("node:assert");
const { transform } = require("../dist/index.js");

test("should perform type stripping", () => {
	assert.strictEqual(typeof transform, "function");
	assert.strictEqual(
		transform("const foo: string = 'bar';"),
		"const foo         = 'bar';",
	);
});
