const { test, snapshot } = require("node:test");
const { transformSync } = require("../dist/index.js");
const path = require("node:path");
const assert = require("node:assert");
const vm = require("node:vm");
const { SourceMap } = require("node:module");

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
	});

	t.assert.snapshot(code);
	t.assert.snapshot(map);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 7);
});

test("should perform transformation with source maps with uncommon chars", (t) => {
	const tsCode = `
    enum Foo {
        Bar = 7,
        Baz = 2,
    }

    output = Foo.Bar`;
	const { code, map } = transformSync(tsCode, {
		mode: "transform",
		sourceMap: true,
		filename: "dir%20with $unusual\"chars?'åß∂ƒ©∆¬…`.cts",
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
		sourceMaps: true,
	});

	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, true);
});

test("should not transform TypeScript class decorators with multiple decorators", (t) => {
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
	});
	t.assert.snapshot(code);
});

test("test noEmptyExport", (t) => {
	const inputCode = `
	import fs = require("fs");
	`;
	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});
	t.assert.snapshot(code);
});

test("should not polyfill using Symbol.Dispose", (t) => {
	const inputCode = `
	using r = 0;`;
	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});
	t.assert.snapshot(code);
});

test("should not polyfill using Symbol.asyncDispose", (t) => {
	const inputCode = `
	await using r = 0;`;
	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});
	t.assert.snapshot(code);
});

test("should have proper error code", (t) => {
	const inputCode = "module F { export type x = number }";
	try {
		transformSync(inputCode, {
			mode: "transform",
		});
	} catch (error) {
		t.assert.snapshot(error);
		assert.strictEqual(error.code, "UnsupportedSyntax");
	}
});

test("should have proper error code", (t) => {
	const inputCode = "const foo;";
	try {
		transformSync(inputCode, {
			mode: "transform",
		});
	} catch (error) {
		t.assert.snapshot(error);
		assert.strictEqual(error.code, "InvalidSyntax");
	}
});

test("should handle short-circuit assignments (&&=, ||=, ??=)", (t) => {
	const inputCode = `
		const a = {}

		a.foo &&= \`\${a.foo}1\`
		console.log(a.foo)

		const b = {}

		b.foo ||= \`\${b.foo}1\`
		console.log(b.foo)

		const c = {}

		c.foo ??= \`\${c.foo}1\`
		console.log(c.foo)
	`;

	const { code } = transformSync(inputCode, {
		mode: "transform",
		sourceMap: true,
	});
	t.assert.snapshot(code);
});

test("should lower parameter properties after super and preserve initialization order", () => {
	const source = `
		const events: string[] = [];
		class Base { constructor() { events.push("base"); } }
		class Derived extends Base {
			field = events.push("field");
			constructor(public value: number) {
				super();
				events.push(String(this.value));
			}
		}
		new Derived(7);
		output = events.join(",");`;
	const { code } = transformSync(source, { mode: "transform" });
	assert.strictEqual(vm.runInNewContext(code), "base,field,7");
});

test("should lower CommonJS import and export assignments", () => {
	const source =
		'import path = require("node:path"); export = path.basename("/a/b");';
	const { code } = transformSync(source, { mode: "transform" });
	const context = { require, module: { exports: undefined } };
	vm.runInNewContext(code, context);
	assert.strictEqual(context.module.exports, "b");
	assert.doesNotMatch(code, /import\.sync/);
});

test("should keep source module markers according to noEmptyExport", () => {
	const source = "export type Value = number;";
	assert.doesNotMatch(
		transformSync(source, { mode: "transform" }).code,
		/export/,
	);
	const { code } = transformSync(source, {
		mode: "transform",
		transform: { noEmptyExport: false },
	});
	assert.match(code, /export\s*\{\s*\}/);
	assert.match(
		transformSync("export {};", { mode: "transform" }).code,
		/export\s*\{\s*\}/,
	);
});

test("should forward verbatimModuleSyntax to SWC Next", () => {
	const source = 'import { value } from "dependency"; output = 1;';
	assert.match(transformSync(source, { mode: "transform" }).code, /import/);
	const { code } = transformSync(source, {
		mode: "transform",
		transform: { verbatimModuleSyntax: false, noEmptyExport: true },
	});
	assert.doesNotMatch(code, /import|export/);
	assert.strictEqual(vm.runInNewContext(code), 1);
});

test("should reject unsupported transform options", () => {
	const check = (transform) =>
		assert.throws(
			() =>
				transformSync("const value: number = 1;", {
					mode: "transform",
					transform,
				}),
			{ code: "UnsupportedSyntax", message: /Unsupported transform option/ },
		);
	check({ nativeClassProperties: false });
	check({ importExportAssignConfig: "NodeNext" });
	check({ tsEnumIsMutable: true });
	check({ importNotUsedAsValues: "preserve" });
	check({ jsx: { transform: "react-jsx" } });
});

test("should map generated locations to UTF-16 columns in the original source", () => {
	const source =
		'enum Value { A = 7 }\n"😀"; throw new Error(String(Value.A));';
	const filename = "dir with spaces/한글.ts";
	const { code, map } = transformSync(source, {
		mode: "transform",
		sourceMap: true,
		filename,
	});
	const payload = JSON.parse(map);
	assert.deepStrictEqual(payload.sources, [filename]);
	assert.deepStrictEqual(payload.sourcesContent, [source]);
	const lines = code.split("\n");
	const line = lines.findIndex((line) => line.includes("new Error"));
	const column = lines[line].indexOf("new Error");
	const entry = new SourceMap(payload).findEntry(line, column);
	assert.strictEqual(entry.originalLine, 1);
	assert.strictEqual(
		entry.originalColumn,
		source.split("\n")[1].indexOf("new Error"),
	);
});
