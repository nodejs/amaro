import type { Options, TransformOutput } from "../lib/wasm";
import swc from "../lib/wasm.js";

const DEFAULT_OPTIONS: Options = {
	mode: "strip-only",
};

export function transformSync(
	source: string,
	options: Options,
): TransformOutput {
	return swc.transformSync(source, {
		...DEFAULT_OPTIONS,
		...options,
	});
}
