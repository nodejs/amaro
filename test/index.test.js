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

test("should perform type stripping on nested generics", (t) => {
	const { code } = transformSync(
		"const promiseWrapper = new Wrapper<<T>(x: T) => Promise<T>>(Promise.resolve.bind(Promise));",
	);
	t.assert.snapshot(code);
});

test("should handle deeply nested expressions", (t) => {
	const source = `var data = ""
if(!(((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((data === "AED") || (data === "AFN")) || (data === "ALL")) || (data === "AMD")) || (data === "ANG")) || (data === "AOA")) || (data === "ARS")) || (data === "AUD")) || (data === "AWG")) || (data === "AZN")) || (data === "BAM")) || (data === "BBD")) || (data === "BDT")) || (data === "BGN")) || (data === "BHD")) || (data === "BIF")) || (data === "BMD")) || (data === "BND")) || (data === "BOB")) || (data === "BOV")) || (data === "BRL")) || (data === "BSD")) || (data === "BTN")) || (data === "BWP")) || (data === "BYN")) || (data === "BZD")) || (data === "CAD")) || (data === "CDF")) || (data === "CHE")) || (data === "CHF")) || (data === "CHW")) || (data === "CLF")) || (data === "CLP")) || (data === "CNY")) || (data === "COP")) || (data === "COU")) || (data === "CRC")) || (data === "CUC")) || (data === "CUP")) || (data === "CVE")) || (data === "CZK")) || (data === "DJF")) || (data === "DKK")) || (data === "DOP")) || (data === "DZD")) || (data === "EGP")) || (data === "ERN")) || (data === "ETB")) || (data === "EUR")) || (data === "FJD")) || (data === "FKP")) || (data === "GBP")) || (data === "GEL")) || (data === "GHS")) || (data === "GIP")) || (data === "GMD")) || (data === "GNF")) || (data === "GTQ")) || (data === "GYD")) || (data === "HKD")) || (data === "HNL")) || (data === "HRK")) || (data === "HTG")) || (data === "HUF")) || (data === "IDR")) || (data === "ILS")) || (data === "INR")) || (data === "IQD")) || (data === "IRR")) || (data === "ISK")) || (data === "JMD")) || (data === "JOD")) || (data === "JPY")) || (data === "KES")) || (data === "KGS")) || (data === "KHR")) || (data === "KMF")) || (data === "KPW")) || (data === "KRW")) || (data === "KWD")) || (data === "KYD")) || (data === "KZT")) || (data === "LAK")) || (data === "LBP")) || (data === "LKR")) || (data === "LRD")) || (data === "LSL")) || (data === "LYD")) || (data === "MAD")) || (data === "MDL")) || (data === "MGA")) || (data === "MKD")) || (data === "MMK")) || (data === "MNT")) || (data === "MOP")) || (data === "MRU")) || (data === "MUR")) || (data === "MVR")) || (data === "MWK")) || (data === "MXN")) || (data === "MXV")) || (data === "MYR")) || (data === "MZN")) || (data === "NAD")) || (data === "NGN")) || (data === "NIO")) || (data === "NOK")) || (data === "NPR")) || (data === "NZD")) || (data === "OMR")) || (data === "PAB")) || (data === "PEN")) || (data === "PGK")) || (data === "PHP")) || (data === "PKR")) || (data === "PLN")) || (data === "PYG")) || (data === "QAR")) || (data === "RON")) || (data === "RSD")) || (data === "RUB")) || (data === "RWF")) || (data === "SAR")) || (data === "SBD")) || (data === "SCR")) || (data === "SDG")) || (data === "SEK")) || (data === "SGD")) || (data === "SHP")) || (data === "SLL")) || (data === "SOS")) || (data === "SRD")) || (data === "SSP")) || (data === "STN")) || (data === "SVC")) || (data === "SYP")) || (data === "SZL")) || (data === "THB")) || (data === "TJS")) || (data === "TMT")) || (data === "TND")) || (data === "TOP")) || (data === "TRY")) || (data === "TTD")) || (data === "TWD")) || (data === "TZS")) || (data === "UAH")) || (data === "UGX")) || (data === "USD")) || (data === "USN")) || (data === "UYI")) || (data === "UYU")) || (data === "UYW")) || (data === "UZS")) || (data === "VES")) || (data === "VND")) || (data === "VUV")) || (data === "WST")) || (data === "XAF")) || (data === "XAG")) || (data === "XAU")) || (data === "XBA")) || (data === "XBB")) || (data === "XBC")) || (data === "XBD")) || (data === "XCD")) || (data === "XDR")) || (data === "XOF")) || (data === "XPD")) || (data === "XPF")) || (data === "XPT")) || (data === "XSU")) || (data === "XTS")) || (data === "XUA")) || (data === "XXX")) || (data === "YER")) || (data === "ZAR")) || (data === "ZMW")) || (data === "ZWL"))) {
  console.log("Hello");
}`;
	assert.doesNotThrow(() => transformSync(source));
});

test("should handle advanced type-level constructs", (t) => {
	const inputCode = `
		type Fn = (x: string) => number;

		type ReturnType<T> = T extends (...args: any) => infer R ? R : never;

		type X = ReturnType<Fn>;

		type Props = { id: string; name: string };
		type Keys = keyof Props;

		type A = typeof Math;
	`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should strip 'satisfies' expressions", (t) => {
	const inputCode = `
		const user = {
			name: "Alice",
			age: 30,
		} satisfies { name: string, age: number };
	`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});

test("should preserve import/export type declarations", (t) => {
	const inputCode = `
		import type { SomeType } from "./types";
		export type { SomeType };
	`;
	const { code } = transformSync(inputCode);
	t.assert.snapshot(code);
});
