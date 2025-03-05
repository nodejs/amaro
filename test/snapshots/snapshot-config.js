import { basename, dirname, extname, join } from "node:path";
import { snapshot } from "node:test";

snapshot.setResolveSnapshotPath(generateSnapshotPath);

function generateSnapshotPath(testFilePath) {
	const ext = extname(testFilePath);
	const filename = basename(testFilePath, ext);
	const base = dirname(testFilePath);
	return join(base, `${filename}.snap.cjs`);
}
