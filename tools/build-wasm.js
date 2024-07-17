const { execSync } = require("node:child_process");
const { resolve } = require("node:path");

const ROOT = resolve(__dirname, "../");
const DOCKERFILE = resolve(__dirname, "./Dockerfile");

const name = "swc_build_wasm";

const build = `docker build -t swc_wasm_typescript -f ${DOCKERFILE} ${ROOT}`;
execSync(build, { stdio: "inherit" });

const run = `docker run -d --name ${name} swc_wasm_typescript`;
execSync(run, { stdio: "inherit" });

// Copies the new directory inside the Docker image to the host.
const copy = `docker cp ${name}:/usr/src/amaro/swc ${ROOT}/lib`;
execSync(copy, { stdio: "inherit" });

// Removes the Docker image.
execSync(`docker rm ${name}`, { stdio: "inherit" });

process.exit(0);
