const { test, snapshot } = require("node:test");
const { transformSync } = require("../dist/index.js");
const assert = require("node:assert");
const path = require("node:path");
const vm = require("node:vm");

snapshot.setResolveSnapshotPath((testPath) => {
	return path.join(
		__dirname,
		"snapshots",
		`${path.basename(testPath)}.snapshot`,
	);
});

test("should transform TypeScript class fields", (t) => {
	const inputCode = `
    class Counter {
      count: number = 0;
      increment() {
        this.count++;
      }
    }
  `;
	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});
	t.assert.snapshot(code);

	const context = { result: null };
	vm.createContext(context);
	vm.runInContext(
		`
      ${code}
      const counter = new Counter();
      counter.increment();
      result = counter.count;
    `,
		context,
	);
	assert.strictEqual(context.result, 1, "Counter should increment to 1");
});

test("should transform TypeScript private class fields", (t) => {
	const inputCode = `
    class Counter {
      #count: number = 0;
      increment() {
        this.#count++;
      }
      getCount(): number {
        return this.#count;
      }
    }
  `;
	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});
	t.assert.snapshot(code);

	const context = { result: null };
	vm.createContext(context);
	vm.runInContext(
		`
      ${code}
      const counter = new Counter();
      counter.increment();
      result = counter.getCount();
    `,
		context,
	);
	assert.strictEqual(
		context.result,
		1,
		"Counter private field should increment to 1",
	);
});

test("should transform TypeScript type annotations and type guards", (t) => {
	const inputCode = `
    function isString(value: unknown): value is string {
      return typeof value === 'string';
    }
  `;
	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMaps: true,
	});
	t.assert.snapshot(code);

	const context = { result: null };
	vm.createContext(context);
	vm.runInContext(
		`
      ${code}
      const check = isString("hello");
      result = check;
    `,
		context,
	);
	assert.strictEqual(
		context.result,
		true,
		"Should recognize 'hello' as a string",
	);
});
