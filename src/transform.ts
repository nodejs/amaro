import type { Options, TransformOutput } from "../lib/wasm";
import swc from "../lib/wasm.js";

const DEFAULT_OPTIONS = {
	mode: "strip-only",
	deprecatedTsModuleAsError: true,
	// default transform will only work when mode is "transform"
	transform: {
		verbatimModuleSyntax: true,
		nativeClassProperties: true,
		noEmptyExport: true,
		importNotUsedAsValues: "preserve",
	},
} as Options;

export function transformSync(
	source: string,
	options?: Options,
): TransformOutput {
	// Ensure that the source code is a string
	const input = `${source ?? ""}`;
	return swc.transformSync(input, {
		...DEFAULT_OPTIONS,
		...options,
	});
}
