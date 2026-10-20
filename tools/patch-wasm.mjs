// Post-processes the wasm-pack output so the WebAssembly binary is embedded in
// wasm.js instead of being read from disk at runtime. Usage:
//
//   node tools/patch-wasm.mjs <pkg-dir>
import fs from "node:fs/promises";
import path from "node:path";

const pkgDir = process.argv[2];
if (!pkgDir) {
	console.error("usage: node tools/patch-wasm.mjs <pkg-dir>");
	process.exit(1);
}

const rawWasmPath = path.join(pkgDir, "wasm_bg.wasm");
const wasmJsPath = path.join(pkgDir, "wasm.js");
const packageJsonPath = path.join(pkgDir, "package.json");

const rawWasmFile = await fs.readFile(rawWasmPath);
const origJsFile = await fs.readFile(wasmJsPath, "utf8");

const base64 = rawWasmFile.toString("base64");
const patchedJsFile = origJsFile
	.replace(`const path = require('path').join(__dirname, 'wasm_bg.wasm');`, "")
	.replace(", fatal: true", "")
	.replace(
		`const bytes = require('fs').readFileSync(path);`,
		`
const { Buffer } = require('node:buffer');
const bytes = Buffer.from('${base64}', 'base64');`,
	);

if (patchedJsFile === origJsFile) {
	console.error(
		"patch-wasm: wasm.js did not match the expected wasm-pack output",
	);
	process.exit(1);
}

await fs.writeFile(wasmJsPath, patchedJsFile);
await fs.unlink(rawWasmPath);

const pkgJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
pkgJson.files = pkgJson.files.filter((file) => file !== "wasm_bg.wasm");
await fs.writeFile(packageJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
