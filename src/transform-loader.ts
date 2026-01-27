import type { LoadFnOutput, LoadHookContext } from "node:module";
import { fileURLToPath } from "node:url";
import type { Options } from "../lib/wasm";
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
	if (format?.endsWith("-typescript")) {
		try {
			const { source } = await nextLoad(url, {
				...context,
				format,
			});

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
	return nextLoad(url, context);
}
