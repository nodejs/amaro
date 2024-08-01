const { describe, test } = require("node:test");
const assert = require("node:assert");
const { transformValidatedStripTypes } = require("../dist/index.js");

describe("transformValidatedStripTypes", () => {
	test("should perform type stripping", () => {
		assert.strictEqual(typeof transformValidatedStripTypes, "function");
		const code = transformValidatedStripTypes("const foo: string = 'bar';");
		assert.strictEqual(code, "const foo         = 'bar';");
	});

	test("should perform type stripping with multi-byte types", () => {
		assert.strictEqual(typeof transformValidatedStripTypes, "function");
		const code = transformValidatedStripTypes("const foo: äöü = 'bar';");
		assert.strictEqual(code, "const foo      = 'bar';");
	});
});
