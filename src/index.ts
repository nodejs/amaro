import type { Options, TransformOutput } from "../lib/swc/wasm.d.ts";
import swc from "../lib/swc/wasm.js";

const DEFAULT_OPTIONS: Options = {
	mode: "strip-only",
};

export function transformSync(
	source: string,
	options: Options,
): TransformOutput {
	return swc.transformSync(source, {
		...DEFAULT_OPTIONS,
		...options,
	});
}

function doesTSStripTypesResultMatchSource(code: string, source: string) {
	if (code.length !== source.length) return false;
	for (let i = 0; i < code.length; i++) {
		// Might return charcodes if surrogate pair started at i-1, which is fine
		// All values swc ever inserts are below \u{10000} and are not UTF-16 surrogate pairs, while some are 3-byte UTF-8
		// We still need to check codePointAt to ensure that already started surrogate pairs at i-1 are not broken by this insertion
		const a = code.codePointAt(i);
		if (a === source.codePointAt(i)) continue;
		// https://github.com/nodejs/amaro/blob/e533394f576f946add41dd8816816435e8100c3b/deps/swc/crates/swc_fast_ts_strip/src/lib.rs#L400-L414
		// https://github.com/nodejs/amaro/blob/e533394f576f946add41dd8816816435e8100c3b/deps/swc/crates/swc_fast_ts_strip/src/lib.rs#L200-L226
		if (
			a !== 0x20 && // 0020 Space [20]
			a !== 0x3b && // 003b Semicolon ; [3b]
			a !== 0xa0 && // 00A0 No-Break Space [c2 a0]
			a !== 0x2002 && // 2002 En Space [e2 80 82]
			a !== 0xfeff // FEFF ZWNBSP [ef bb bf]
		) {
			return false;
		}
	}
	return true;
}

export function transformValidatedStripTypes(source: string): string {
	const { code } = transformSync(source, { mode: "strip-only" });
	if (!doesTSStripTypesResultMatchSource(code, source)) {
		throw new Error("swc returned unexpected transform result");
	}
	return code;
}
