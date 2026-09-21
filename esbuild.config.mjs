import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";

const common = {
	platform: "node",
	format: "cjs",
	target: "node22",
};

await build({
	...common,
	entryPoints: ["src/internal.ts"],
	bundle: true,
	outfile: "dist/internal.js",
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

// Everything else is a thin wrapper that requires `./internal.js`.
await build({
	...common,
	entryPoints: [
		"src/index.ts",
		"src/errors.ts",
		"src/strip-loader.ts",
		"src/transform-loader.ts",
	],
	bundle: false,
	outdir: "dist",
	outbase: "src",
});
