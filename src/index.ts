import swc from "../lib/swc/wasm.js";
import type { Options, TransformOutput } from "../lib/swc/wasm.d.ts";

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
