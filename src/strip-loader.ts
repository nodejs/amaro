import type { LoadFnOutput, LoadHookContext } from "node:module";
import { fileURLToPath } from "node:url";
import { isSwcError, wrapAndReThrowSwcError } from "./errors.js";
import { transformSync } from "./index.js";

type NextLoad = (
	url: string,
	context?: Partial<LoadHookContext>,
) => LoadFnOutput;

function strip(url: string, format: string, source: LoadFnOutput["source"]) {
	try {
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

// Synchronous hook for `module.registerHooks()`.
export function loadSync(
	url: string,
	context: LoadHookContext,
	nextLoad: NextLoad,
) {
	const { format } = context;
	if (format?.endsWith("-typescript")) {
		const { source } = nextLoad(url, { ...context, format });
		return strip(url, format, source);
	}
	return nextLoad(url, context);
}

// Asynchronous hook for `module.register()`, used on Node.js versions that
// do not provide `module.registerHooks()`.
export async function load(
	url: string,
	context: LoadHookContext,
	nextLoad: (
		url: string,
		context?: Partial<LoadHookContext>,
	) => LoadFnOutput | Promise<LoadFnOutput>,
) {
	const { format } = context;
	if (format?.endsWith("-typescript")) {
		const { source } = await nextLoad(url, { ...context, format });
		return strip(url, format, source);
	}
	return nextLoad(url, context);
}
