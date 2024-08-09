const { test, snapshot } = require("node:test");
const { transformSync } = require("../dist/index.js");
const path = require("node:path");
const assert = require("node:assert");
const vm = require("node:vm");

// Set the path for the snapshots directory
snapshot.setResolveSnapshotPath((testPath) => {
	return path.join(
		__dirname,
		"snapshots",
		`${path.basename(testPath)}.snapshot`,
	);
});

test("should perform transformation without source maps", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }

    x = Foo.Bar`;
	const { code, map } = transformSync(tsCode, {
		mode: "transform",
	});
	t.assert.snapshot(code);
	assert.strictEqual(vm.runInContext(code, vm.createContext({ x: 0 })), 7);
	assert.strictEqual(map, undefined);
});

test("should perform transformation without source maps and filename", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }

    x = Foo.Bar`;
	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		filename: "foo.ts",
	});
	t.assert.snapshot(code);
	assert.strictEqual(vm.runInContext(code, vm.createContext({ x: 0 })), 7);
	assert.strictEqual(map, undefined);
});

test("should perform transformation with source maps", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }

    x = Foo.Bar`;
	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		sourceMap: true,
		filename: "foo.ts",
	});
	t.assert.snapshot(code);
	assert.strictEqual(vm.runInContext(code, vm.createContext({ x: 0 })), 7);
	t.assert.snapshot(map);
});

test("should perform transformation with source maps no filename", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }

    x = Foo.Bar`;
	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		sourceMap: true,
	});
	t.assert.snapshot(code);
	assert.strictEqual(vm.runInContext(code, vm.createContext({ x: 0 })), 7);
	t.assert.snapshot(map);
});

test("should perform transformation with error", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }

    x = Foo.Bar;
    throw new Error("foo");`;
	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		sourceMap: true,
		filename: "foo.ts",
	});
	t.assert.snapshot(code);
	const context = { x: 0 };
	vm.createContext(context);
	try {
		assert.throws(vm.runInContext(code, context));
	} catch (error) {
		assert.strictEqual(error.message, "foo");
	}
	assert.strictEqual(context.x, 7);
	t.assert.snapshot(map);
});
