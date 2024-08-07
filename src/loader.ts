import swc from "../lib/wasm.js";
import type { LoadHook } from "node:module";
import { readFile } from "node:fs/promises";

export const load: LoadHook = async (source, context, nextLoad) => {
	if (context.format?.includes("typescript")) {
		const data = await readFile(source, "utf8");
		return {
			source: swc.transformSync(data).code,
			shortCircuit: true, // Skips bundled transpilation
		};
	}
	return { source: await nextLoad(source, context) };
};
