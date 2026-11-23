const { test } = require("node:test");
const assert = require("node:assert");
const { __wasm, transformSync } = require("../lib/wasm.js");

const INITIAL_MEMORY_BYTES = 16 * 1024 * 1024;

// tools/config.toml sets the initial memory with a linker flag, which a build
// that doesn't read that file drops without failing.
test("should start with 16 MiB of memory", () => {
	assert.strictEqual(__wasm.memory.buffer.byteLength, INITIAL_MEMORY_BYTES);
});

test("should not grow the memory for a 64 KB source", () => {
	const source = "const a: number = 1;\n".repeat(3200);
	const before = __wasm.memory.buffer.byteLength;

	transformSync(source, { mode: "strip-only" });

	assert.strictEqual(__wasm.memory.buffer.byteLength, before);
});
