import type { LoadFnOutput, LoadHook, LoadHookSync } from "node:module";
import { fileURLToPath } from "node:url";
import { isSwcError, wrapAndReThrowSwcError } from "./errors.js";
import { transformSync } from "./index.js";

function stripTypeScript(
	url: string,
	format: string,
	source: LoadFnOutput["source"],
): LoadFnOutput {
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
}

export const load: LoadHook = async (url, context, nextLoad) => {
	const { format } = context;
	if (format?.endsWith("-typescript")) {
		try {
			const { source } = await nextLoad(url, { ...context, format });
			return stripTypeScript(url, format, source);
		} catch (error: unknown) {
			if (isSwcError(error)) {
				wrapAndReThrowSwcError(error);
			}
			// If the error is not an SwcError, rethrow it
			throw error;
		}
	}
	return nextLoad(url, context);
};

export const loadSync: LoadHookSync = (url, context, nextLoad) => {
	const { format } = context;
	if (format?.endsWith("-typescript")) {
		try {
			const { source } = nextLoad(url, { ...context, format });
			return stripTypeScript(url, format, source);
		} catch (error: unknown) {
			if (isSwcError(error)) {
				wrapAndReThrowSwcError(error);
			}
			// If the error is not an SwcError, rethrow it
			throw error;
		}
	}
	return nextLoad(url, context);
};
