const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");

const ROOT = resolve(__dirname, "../");
const DOCKERFILE = resolve(__dirname, "./Dockerfile");

const name = `swc_build_wasm-${Date.now()}`;

const buildArgs = [
	"build",
	"-t",
	"swc_wasm_typescript",
	"-f",
	DOCKERFILE,
	ROOT,
];
execFileSync("docker", buildArgs, { stdio: "inherit" });

const runArgs = ["run", "-d", "--name", name, "swc_wasm_typescript"];
execFileSync("docker", runArgs, { stdio: "inherit" });

// Copies the new directory inside the Docker image to the host.
const copyArgs = ["cp", `${name}:/usr/src/amaro/swc/.`, `${ROOT}/lib/`];
execFileSync("docker", copyArgs, { stdio: "inherit" });

// Removes the Docker image.
execFileSync("docker", ["rm", name], { stdio: "inherit" });

process.exit(0);
