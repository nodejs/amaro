const WASM_BUILDER_CONTAINER =
	"ghcr.io/nodejs/wasm-builder@sha256:975f391d907e42a75b8c72eb77c782181e941608687d4d8694c3e9df415a0970"; // v0.0.9

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
	// we must map in a home directory since we might not run as a user that
	// is defined in the container. Create it here.
	const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "amaro-build"));

	// buile and execute the docker command to run the build
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
	args.push(
		`type=bind,source=${ROOT}/deps/swc/bindings,target=/home/node/build/bindings`,
	);
	args.push("--mount");
	args.push(`type=bind,source=${ROOT}/lib,target=/home/node/build/lib`);
	args.push("--mount");
	args.push(`type=bind,source=${ROOT}/tools,target=/home/node/build/tools`);
	args.push("--mount");
	args.push(`type=bind,source=${ROOT}/deps,target=/home/node/build/deps`);
	args.push("--mount");
	args.push(`type=bind,source=${workdir},target=/home/node/home`);
	args.push("-t");
	args.push(`${WASM_BUILDER_CONTAINER}`);
	args.push("node");
	args.push("./tools/build-wasm.js");
	args.push("--in-container");
	console.log(`> docker ${args}\n\n`);
	execFileSync("docker", args, { stdio: "inherit" });

	// clean up the temporary working directory and then exit
	fs.rmSync(workdir, { recursive: true });
	process.exit(0);
}

execSync(
	`HOME=/home/node/home && \
         cd bindings/binding_typescript_wasm && \ 
         cargo install --locked wasm-pack && \
         PATH=/home/node/home/.cargo/bin:$PATH && \
         ./scripts/build.sh && \
         cp -r pkg/* ../../lib`,
	{ stdio: "inherit" },
);
