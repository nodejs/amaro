import type { LoadFnOutput, LoadHookContext } from "node:module";
import { fileURLToPath } from "node:url";
import type { Options } from "../lib/wasm";
import { isSwcError, wrapAndReThrowSwcError } from "./errors.js";
import { transformSync } from "./index.js";

type NextLoad = (
	url: string,
	context?: Partial<LoadHookContext>,
) => LoadFnOutput;

function transform(
	url: string,
	format: string,
	source: LoadFnOutput["source"],
) {
	try {
		// biome-ignore lint/style/noNonNullAssertion: If module exists, it will have a source
		const { code, map } = transformSync(source!.toString(), {
			mode: "transform",
			sourceMap: true,
			filename: fileURLToPath(url),
		} as Options);

		let output = code;

		if (map) {
			const base64SourceMap = Buffer.from(map).toString("base64");
			output = `${code}\n\n//# sourceMappingURL=data:application/json;base64,${base64SourceMap}`;
		}

		return {
			format: format.replace("-typescript", ""),
			source: `${output}\n\n//# sourceURL=${url}`,
		};
	} catch (error) {
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
		return transform(url, format, source);
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
		return transform(url, format, source);
	}
	return nextLoad(url, context);
}
