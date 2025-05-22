import { register } from "node:module";
import { emitWarning } from "node:process";

if (process.execArgv?.some((arg) => arg.includes("amaro/register"))) {
	emitWarning(
		"amaro/register is deprecated, please use amaro/strip instead",
		"DeprecationWarning",
	);
}

register("./strip-loader.js", import.meta.url);
