import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";

await build({
	entryPoints: ["src/*.ts"],
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
