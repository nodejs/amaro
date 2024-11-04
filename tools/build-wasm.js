const { execSync, execFileSync } = require("node:child_process");
const { resolve } = require("node:path");

const WASM_BUILDER_CONTAINER =
	"ghcr.io/nodejs/wasm-builder@sha256:975f391d907e42a75b8c72eb77c782181e941608687d4d8694c3e9df415a0970"; // v0.0.9

const ROOT = resolve(__dirname, "../");

function getPlatformFromDocker() {
	try {
		return execFileSync("docker", [
			"info",
			"-f",
			"{{.OSType}}/{{.Architecture}}",
		])
			.toString()
			.trim();
	} catch (error) {
		console.error(
			"Error retrieving platform information from Docker:",
			error.message,
		);
	}
}

function runDockerContainer() {
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
	args.push("-t");
	args.push(`${WASM_BUILDER_CONTAINER}`);
	args.push("node");
	args.push("./tools/build-wasm.js");
	console.log(`> docker ${args}\n\n`);
	execFileSync("docker", args, { stdio: "inherit" });
}

let platform = process.env.WASM_PLATFORM;
if (!platform && process.argv[2]) {
	platform = getPlatformFromDocker();
}

// If "--docker" is passed, run the Docker container with the specified mounts
if (process.argv[2] === "--docker") {
	runDockerContainer();
	process.exit(0);
}

const wasmBindingPath = `${ROOT}/bindings/binding_typescript_wasm`;

const commands = [
	`cd ${wasmBindingPath}`,
	"cargo install --locked wasm-pack",
	"export PATH=/home/node/.cargo/bin:$PATH",
	`sh ${wasmBindingPath}/scripts/build.sh`,
	`cp -r ${wasmBindingPath}/pkg/* ${ROOT}/lib`,
];

try {
	for (const command of commands) {
		execSync(command, { stdio: "inherit" });
	}
} catch (error) {
	console.error("Error executing build command:", error.message);
	process.exit(1);
}
