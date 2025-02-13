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

test("should perform type stripping", (t) => {
	const { code } = transformSync("const foo: string = 'bar';");
	t.assert.snapshot(code);
});

test("should strip type annotations from functions", (t) => {
	const inputCode = "function greet(name: string): void { console.log(name); }";
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should strip type annotations from classes", (t) => {
	const inputCode = `
    class MyClass {
      myMethod(param: number): string {
        return param.toString();
      }
    }
  `;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should strip type annotations from interfaces", (t) => {
	const inputCode = `
    interface MyInterface {
      myMethod(param: number): string;
    }
  `;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should strip type annotations from type aliases", (t) => {
	const inputCode = `
    type MyType = string | number;
  `;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should strip type annotations from generics", (t) => {
	const inputCode = `
    function identity<T>(arg: T): T {
      return arg;
    }
  `;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should strip type annotations from arrow functions", (t) => {
	const inputCode = `
    const greet = (name: string): void => {
      console.log(name);
    };
  `;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should strip type annotations from type assertions", (t) => {
	const inputCode = `
    let someValue: any = "this is a string";
    let strLength: number = (someValue as string).length;
  `;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should handle User type and isAdult function", (t) => {
	const inputCode = `
    type User = {
      name: string;
      age: number;
    };

    function isAdult(user: User): boolean {
      return user.age >= 18;
    }
  `;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should handle class modifiers", (t) => {
	const inputCode = `
		class PrivateConstructor {
		  private constructor() {}
		  public a() {}
		  protected b() {}
		  static create() {
		    return new PrivateConstructor()
		  }
		}

		const ins = PrivateConstructor.create()
		console.log(ins)
	`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
	assert.strictEqual(code.includes("private"), false);
	assert.strictEqual(code.includes("protected"), false);
	assert.strictEqual(code.includes("public"), false);
});

test("should handle empty source code", (t) => {
	assert.strictEqual(transformSync().code, "");
	assert.throws(() => transformSync({}).code);
	assert.strictEqual(transformSync(false).code, "false");
	assert.strictEqual(transformSync(undefined).code, "");
	assert.strictEqual(transformSync(null).code, "");
	assert.strictEqual(transformSync("").code, "");
});

test("should not polyfill using Symbol.Dispose", (t) => {
	const inputCode = `
	class Resource {
		[Symbol.dispose]() { console.log("Disposed"); }
	}
	using r = new Resource();`;
	const { code } = transformSync(inputCode);
	assert.strictEqual(code, inputCode);
});

test("should not polyfill using Symbol.asyncDispose", (t) => {
	const inputCode = `
	class AsyncResource {
		async [Symbol.asyncDispose]() { console.log("Async disposed"); }
	}
	await using r = new AsyncResource();`;
	const { code } = transformSync(inputCode);
	assert.strictEqual(code, inputCode);
});

test("should not break on return new line when stripped", (t) => {
	const inputCode = `
	function mkId() {
		return <T>
			(x: T)=>x;
	}
	const id = mkId();
	output = id(5);`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 5);
});

test("should not break on return new line when stripped (alternative formatting)", (t) => {
	const inputCode = `
	function mkId() {
		return <
			T
		>(x: T)=>x;
	}
	const id = mkId();
	output = id(7);`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 7);
});

test("should not throw on return new line when stripped", (t) => {
	const inputCode = `
	function mkId() {
		throw <
			T
		>(x: T)=>x;
	}

	try {
		mkId();
	}
	catch(e){
		output = e(5);
	}`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 5);
});

test("should not throw on yield new line when stripped", (t) => {
	const inputCode = `
	function* mkId() {
		yield <
				T
		>(x: T)=>x;
	}
	output= mkId().next().value(5);`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
	const result = vm.runInContext(code, vm.createContext());
	assert.strictEqual(result, 5);
});

test("should throw invalid syntax error", (t) => {
	assert.throws(() => transformSync("const foo;"));
});

test("erasable namespaces and modules should be supported", (t) => {
	const tests = [
		"namespace Empty {}",
		`namespace TypeOnly {
    		type A = string;

    		export type B = A | number;

   			export interface I {}

			export namespace Inner {
				export type C = B;
			}
		}`,
		`namespace My.Internal.Types {
    		export type Foo = number;
		}`,
		"declare namespace C { export let x = 1 }",
	];
	for (const input of tests) {
		const { code } = transformSync(input);
		t.assert.snapshot(code);
	}
});

test("should throw on non erasable namespace/module", (t) => {
	const tests = [
		"namespace A { export let x = 1 }",
		`namespace With.Imports {
    		import Types = My.Internal.Types;
    		export type Foo = Types.Foo;
		}`,
		"namespace B { ; } ",
		"module E { export let x = 1 }",
		`namespace A { export let x = 1; }
         namespace B { import x = A.x; }
         namespace C { export import x = A.x; }`,
		"declare module    D { export let x = 1 }",
		"module F { export type x = number }",
	];

	for (const input of tests) {
		assert.throws(() => transformSync(input), { code: "UnsupportedSyntax" });
	}
});
