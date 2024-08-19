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
    output = Foo.Bar`;

	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 7);
	assert.strictEqual(map, undefined);
});

test("should perform transformation without source maps and filename", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }
    output = Foo.Bar`;

	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		filename: "foo.ts",
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 7);
	assert.strictEqual(map, undefined);
});

test("should perform transformation with source maps", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }

    output = Foo.Bar`;
	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		sourceMap: true,
		filename: "foo.ts",
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	t.assert.snapshot(map);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 7);
});

test("should perform transformation with source maps no filename", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }
    output = Foo.Bar`;

	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		sourceMap: true,
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	t.assert.snapshot(map);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 7);
});

test("should perform transformation with error", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }
    output = Foo.Bar;
    throw new Error("foo");`;

	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		sourceMap: true,
		filename: "foo.ts",
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	t.assert.snapshot(map);
	const context = {};
	try {
		assert.throws(vm.runInContext(code, vm.createContext(context)));
	} catch (error) {
		assert.strictEqual(error.message, "foo");
	}
	assert.strictEqual(context.output, 7);
});

test("should transform TypeScript class fields", (t) => {
	const inputCode = `
    class Counter {
      count: number = 0;
      increment() {
        this.count++;
      }
    }

	const counter = new Counter();
    counter.increment();
    output = counter.count;`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 1);
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

	const counter = new Counter();
    counter.increment();
    output = counter.getCount();`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 1);
});

test("should transform TypeScript type annotations and type guards", (t) => {
	const inputCode = `
    function isString(value: unknown): value is string {
      return typeof value === 'string';
    }
	const check = isString("hello");
    output = check;`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, true);
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

	output = new BugReport("Test");`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	const context = {};
	try {
		assert.throws(vm.runInContext(code, vm.createContext(context)));
	} catch (error) {
		assert.strictEqual(error.message, "Invalid or unexpected token");
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
	output = {
		validator,
		isValid
	}`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
		transform: {
			verbatimModuleSyntax: true,
		},
	});

	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.ok(result.validator);
	assert.strictEqual(result.isValid, true);
});

test("test native class properties", (t) => {
	const inputCode = `
	class Foo {
		x = console.log(1)
		constructor(public y = console.log(2)) {
			console.log(3)
		}
	}`;
	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
		transform: {
			verbatimModuleSyntax: true,
		},
	});
	
	t.assert.snapshot(code);
});
