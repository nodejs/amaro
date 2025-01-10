import type { LoadFnOutput, LoadHookContext } from "node:module";
import { isSwcError, wrapAndReThrowSwcError } from "./errors.js";
import { transformSync } from "./index.js";

export async function load(
	url: string,
	context: LoadHookContext,
	nextLoad: (
		url: string,
		context?: LoadHookContext,
	) => LoadFnOutput | Promise<LoadFnOutput>,
) {
	const { format } = context;
	if (format.endsWith("-typescript")) {
		// Use format 'module' so it returns the source as-is, without stripping the types.
		// Format 'commonjs' would not return the source for historical reasons.
		try {
			const { source } = await nextLoad(url, {
				...context,
				format: "module",
			});
			// biome-ignore lint/style/noNonNullAssertion: If module exists, it will have a source
			const { code } = transformSync(source!.toString(), {
				mode: "strip-only",
			});
			return {
				format: format.replace("-typescript", ""),
				// Source map is not necessary in strip-only mode. However, to map the source
				// file in debuggers to the original TypeScript source, add a sourceURL magic
				// comment to hint that it is a generated source.
				source: `${code}\n\n//# sourceURL=${url}`,
			};
		} catch (error: unknown) {
			if (isSwcError(error)) {
				wrapAndReThrowSwcError(error);
			}
			// If the error is not an SwcError, rethrow it
			throw error;
		}
	}
	return nextLoad(url, context);
}
