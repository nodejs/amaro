const { transformSync } = require("../lib/swc/wasm");

const DEFAULT_OPTIONS = {
	mode: "strip-only",
};

// biome-ignore lint/suspicious/noExplicitAny: Swc types are not available
function transform(source: string, options?: any): string {
	const result = transformSync(source, {
		...DEFAULT_OPTIONS,
		...options,
	});
	return result;
}

module.exports = {
	transform,
};
