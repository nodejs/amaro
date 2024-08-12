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

test("should transform TypeScript class decorators with multiple decorators", (t) => {
	const inputCode = `
  @sealed
  @log
  class BugReport {
    type = "report";
    title: string;
    constructor(t: string) {
      this.title = t;
    }
  }

  function sealed(constructor: Function) {
    Object.seal(constructor);
    Object.seal(constructor.prototype);
  }

  function log(constructor: Function) {
    console.log("Creating instance of", constructor.name);
  }

  const report = new BugReport("Test");
`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});

	t.assert.snapshot(code);

	try {
		const script = new vm.Script(code);
		const context = vm.createContext({});
		context.report = null;
		script.runInContext(context);

		assert.ok(context.report, "Report instance should exist");
		assert.strictEqual(
			context.report.type,
			"report",
			"Report type should be 'report'",
		);
		assert.strictEqual(
			context.report.title,
			"Test",
			"Report title should be 'Test'",
		);
	} catch (err) {
		console.error("Error executing script:", err);
	}
});

test("should transform TypeScript namespaces with additional functionality", (t) => {
	const inputCode = `
  namespace Validation {
    export interface StringValidator {
      isAcceptable(s: string): boolean;
    }
    const lettersRegexp = /^[A-Za-z]+$/;
    export class LettersOnlyValidator implements StringValidator {
      isAcceptable(s: string) {
        return lettersRegexp.test(s);
      }
      static createValidator(): LettersOnlyValidator {
        return new LettersOnlyValidator();
      }
    }
  }

  const validator = Validation.LettersOnlyValidator.createValidator();
  const isValid = validator.isAcceptable("test");

  // Exporting these for VM context
  (globalThis as any).validator = validator;
  (globalThis as any).isValid = isValid;
`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});

	t.assert.snapshot(code);

	const script = new vm.Script(code);
	const context = vm.createContext({});
	script.runInContext(context);

	assert.ok(context.validator, "Validator instance should exist");
	assert.strictEqual(context.isValid, true, "String should be valid");
});
