import type { Options, TransformOutput } from "../lib/wasm";
import swc from "../lib/wasm.js";

const DEFAULT_OPTIONS: Options = {
	mode: "strip-only",
};

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
