const swc = require("../lib/swc/wasm.js");

const DEFAULT_OPTIONS = {
	mode: "strip-only",
};

// biome-ignore lint/suspicious/noExplicitAny: Swc types are not available
function transformSync(source: string, options?: any): string {
	return swc.transformSync(source, {
		...DEFAULT_OPTIONS,
		...options,
	});
}

module.exports = {
	transformSync,
};
