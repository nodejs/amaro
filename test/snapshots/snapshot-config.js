const { basename, dirname, extname, join } = require("node:path");
const { snapshot } = require("node:test");

snapshot.setResolveSnapshotPath(generateSnapshotPath);

function generateSnapshotPath(testFilePath) {
	const ext = extname(testFilePath);
	const filename = basename(testFilePath, ext);
	const base = dirname(testFilePath);
	return join(base, `${filename}.snap.cjs`);
}
