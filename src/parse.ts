import type { Options, Program } from "../lib/wasm";
import swc from "../lib/wasm.js";

export function parseSync(source: string, options?: Options): Program {
	// Ensure that the source code is a string
	const input = `${source ?? ""}`;
	return swc.parseSync(input, options);
}
