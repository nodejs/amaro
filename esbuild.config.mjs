import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";

const copyPlugin = copy({
	assets: [
		{
			from: ["./src/register/register-strip.mjs"],
			to: ["."],
		},
		{
			from: ["./src/register/register-transform.mjs"],
			to: ["."],
		},
		{
			from: ["./lib/LICENSE", "./lib/package.json"],
			to: ["."],
		},
	],
});

await build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	target: "node22",
	outfile: "dist/index.js",
	plugins: [copyPlugin],
});

await build({
	entryPoints: ["src/errors.ts"],
	platform: "node",
	target: "node22",
	outfile: "dist/errors.js",
});

await build({
	entryPoints: ["src/strip-loader.ts"],
	bundle: false,
	outfile: "dist/strip-loader.js",
	platform: "node",
	target: "node22",
});

await build({
	entryPoints: ["src/transform-loader.ts"],
	bundle: false,
	outfile: "dist/transform-loader.js",
	platform: "node",
	target: "node22",
});
