const { transformSync } = require("../lib/swc/wasm");

const DEFAULT_OPTIONS = {
	mode: "strip-only",
};

// biome-ignore lint/suspicious/noExplicitAny: Swc types are not available
function transform(source: string, options?: any): string {
	const { code } = transformSync(source, {
		...DEFAULT_OPTIONS,
		...options,
	});
	return code;
}

module.exports = {
	transform,
};
