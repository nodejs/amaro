const { test, snapshot } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("../dist/index.js");

snapshot.setResolveSnapshotPath((testPath) => {
	return path.join(
		__dirname,
		"snapshots",
		`${path.basename(testPath)}.snapshot`,
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
