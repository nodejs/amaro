const { test, snapshot } = require("node:test");
const { transformSync } = require("../dist/index.js");
const path = require("node:path");
const assert = require("node:assert");

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

test("should handle empty source code", (t) => {
	assert.strictEqual(transformSync().code, "");
	assert.throws(() => transformSync({}).code);
	assert.strictEqual(transformSync(false).code, "false");
	assert.strictEqual(transformSync(undefined).code, "");
	assert.strictEqual(transformSync(null).code, "");
	assert.strictEqual(transformSync("").code, "");
});

test("should not perform import elision", (t) => {
	const inputCode = `
	import { foo } from ".";
	export { };
  `;
	assert.strictEqual(
		transformSync(inputCode, { mode: "transform" }).code,
		inputCode,
	);
});
