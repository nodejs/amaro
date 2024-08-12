const { copy } = require("esbuild-plugin-copy");
const esbuild = require("esbuild");

esbuild.build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	target: "node20",
	outdir: "dist",
	plugins: [
		copy({
			assets: {
				from: ["./src/register/register.mjs"],
				to: ["."],
			},
		}),
	],
});
