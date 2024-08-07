import assert from "node:assert";
import type { LoadFnOutput, LoadHookContext } from "node:module";
import { transformSync } from "./index.ts";

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
		if (source == null)
			throw new Error("Source code cannot be null or undefined");
		const { code } = transformSync(source.toString(), { mode: "strip-only" });
		return {
			format: format.replace("-typescript", ""),
			source: code,
		};
	}
	return nextLoad(url, context);
}
