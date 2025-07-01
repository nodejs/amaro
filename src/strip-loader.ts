import type { LoadFnOutput, LoadHookContext } from "node:module";
import { fileURLToPath } from "node:url";
import { isSwcError, wrapAndReThrowSwcError } from "./errors.js";
import { transformSync } from "./index.js";
import { isTypeScript } from "./ts-detect.js";

export async function load(
	url: string,
	context: LoadHookContext,
	nextLoad: (
		url: string,
		context?: LoadHookContext,
	) => LoadFnOutput | Promise<LoadFnOutput>,
) {
	let format = context.format;
	let source: string | undefined;

	if (typeof format !== "string") {
		const result = await nextLoad(url, { ...context, format: "module" });
		source = result.source?.toString();
		if (isTypeScript(url, source)) {
			const { code } = transformSync(source!, {
				mode: "strip-only",
				filename: fileURLToPath(url),
			});
			return {
				format: "module",
				source: `${code}\n\n//# sourceURL=${url}`,
			};
		}
		return result;
	}
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
				filename: fileURLToPath(url),
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
