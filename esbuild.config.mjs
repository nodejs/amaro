import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";

await build({
	entryPoints: [
		"src/errors.ts",
		"src/index.ts",
		"src/nodejs.ts",
		"src/transform.ts",
	],
	bundle: false,
	outdir: "dist",
	outbase: "src",
	platform: "node",
	format: "cjs",
	target: "node22",
	plugins: [
		copy({
			assets: [
				{
					from: ["./src/register/*.mjs"],
					to: ["."],
				},
				{
					from: ["./lib/LICENSE", "./lib/package.json"],
					to: ["."],
				},
			],
		}),
	],
});

await build({
	entryPoints: ["src/*-loader.ts"],
	bundle: false,
	outdir: "dist",
	outbase: "src",
	outExtension: { ".js": ".mjs" },
	platform: "node",
	format: "esm",
	target: "node22",
});
