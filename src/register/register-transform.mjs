import * as module from "node:module";
import { emitWarning, env, execArgv } from "node:process";

const hasSourceMaps =
	execArgv.includes("--enable-source-maps") ||
	env.NODE_OPTIONS?.includes("--enable-source-maps");

if (!hasSourceMaps) {
	emitWarning("Source maps are disabled, stack traces will not be accurate");
}

if (typeof module.registerHooks === "function") {
	const { loadSync } = await import("./transform-loader.mjs");
	module.registerHooks({ load: loadSync });
} else {
	module.register("./transform-loader.mjs", import.meta.url);
}
