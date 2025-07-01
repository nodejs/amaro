import type { LoadFnOutput, LoadHookContext } from "node:module";
import { fileURLToPath } from "node:url";
import type { Options } from "../lib/wasm";
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
		// Try to detect from extension or content
		const result = await nextLoad(url, { ...context, format: "module" });
		source = result.source?.toString();
		if (isTypeScript(url, source)) {
			const { code, map } = transformSync(source!, {
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
				format: "module",
				source: `${output}\n\n//# sourceURL=${url}`,
			};
		}
		return result;
	}
	if (format.endsWith("-typescript")) {
		try {
			// Use format 'module' so it returns the source as-is, without stripping the types.
			// Format 'commonjs' would not return the source for historical reasons.
			const { source } = await nextLoad(url, {
				...context,
				format: "module",
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
