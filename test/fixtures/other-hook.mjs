import { registerHooks } from "node:module";

registerHooks({
	load(url, context, nextLoad) {
		const result = nextLoad(url, context);
		if (url.endsWith("/hello.js")) {
			console.log("other hook saw hello.js");
		}
		return result;
	},
});
