import type { LoadFnOutput, LoadHookContext } from "node:module";
import type { Options } from "../lib/wasm";
import { transformSync } from "./index.js";

type NextLoad = (
	url: string,
	context?: LoadHookContext,
) => LoadFnOutput | Promise<LoadFnOutput>;

export async function load(
	url: string,
	context: LoadHookContext,
	nextLoad: NextLoad,
) {
	const { format } = context;
	if (format.endsWith("-typescript")) {
		// Use format 'module' so it returns the source as-is, without stripping the types.
		// Format 'commonjs' would not return the source for historical reasons.
		const { source } = await nextLoad(url, {
			...context,
			format: "module",
		});
		// biome-ignore lint/style/noNonNullAssertion: If module exists, it will have a source
		const { code } = transformSync(source!.toString(), {
			mode: "strip-only",
		} as Options);
		return {
			format: format.replace("-typescript", ""),
			// Source map is not necessary in strip-only mode. However, to map the source
			// file in debuggers to the original TypeScript source, add a sourceURL magic
			// comment to hint that it is a generated source.
			source: `${code}\n\n//# sourceURL=${url}`,
		};
	}
	return nextLoad(url, context);
}
