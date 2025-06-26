const WASM_BUILDER_CONTAINER =
	"ghcr.io/nodejs/wasm-builder@sha256:542fdbef9fa6eb003cc1eb89a9f3e6b967359471fdb29db4910c54474e70911d"; // v0.0.10

const { execSync, execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = resolve(__dirname, "../");

let platform = process.env.WASM_PLATFORM;
if (!platform && !process.argv[2]) {
	platform = execFileSync("docker", [
		"info",
		"-f",
		"{{.OSType}}/{{.Architecture}}",
	])
		.toString()
		.trim();
}

if (process.argv[2] !== "--in-container") {
	// build and execute the docker command to run the build
	const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "amaro-build"));

	const args = [];
	args.push("run");
	args.push("--rm");
	args.push("--platform");
	args.push(`${platform.toString().trim()}`);
	if (process.platform === "linux") {
		args.push("--user");
		args.push(`${process.getuid()}:${process.getegid()}`);
	}
	args.push("--mount");
	args.push(`type=bind,source=${ROOT}/deps,target=/home/node/build/deps`);
	args.push("--mount");
	args.push(`type=bind,source=${ROOT}/lib,target=/home/node/build/lib`);
	args.push("--mount");
	args.push(`type=bind,source=${ROOT}/tools,target=/home/node/build/tools`);
	args.push("--mount");
	args.push(`type=bind,source=${workdir},target=/home/node/home`);
	args.push("-t");
	args.push(`${WASM_BUILDER_CONTAINER}`);
	args.push("node");
	args.push("./tools/build-wasm.js");
	args.push("--in-container");
	console.log(`> docker ${args.join(" ")}\n\n`);
	execFileSync("docker", args, { stdio: "inherit" });

	// clean up the temporary working directory
	fs.rmSync(workdir, { recursive: true });
	process.exit(0);
}

execSync(
	`cp -r /home/node/.rustup /home/node/home/.rustup && \
     export HOME=/home/node/home && \
     export PATH=/home/node/home/.cargo/bin:$PATH && \
     rustc --version && \
     cd deps/swc/bindings/binding_typescript_wasm && \
     cargo install --locked wasm-pack wasm-bindgen-cli && \
     ./scripts/build.sh -- --config ../../../../tools/config.toml && \
     cp -r pkg/* ../../../../lib`,
	{
		stdio: "inherit",
	},
);
