const { transformSync } = require("@swc/wasm-typescript");

function stripTypes(source: string): string {
	const result = transformSync(source, {
		mode: "strip-only",
	});
	return result;
}

module.exports = {
	stripTypes,
};
