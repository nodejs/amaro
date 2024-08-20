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
		const { code, map } = transformSync(source!.toString(), {
			mode: "transform",
			sourceMap: true,
			filename: url,
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
	}
	return nextLoad(url, context);
}
