import * as module from "node:module";

if (typeof module.registerHooks === "function") {
	const { loadSync } = await import("./strip-loader.mjs");
	module.registerHooks({ load: loadSync });
} else {
	module.register("./strip-loader.mjs", import.meta.url);
}
