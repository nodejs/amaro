import type {
	ModuleSyntaxTransformOutput,
	Options,
	TransformOutput,
} from "../lib/wasm";
import swc from "../lib/wasm.js";

const DEFAULT_OPTIONS = {
	mode: "strip-only",
	deprecatedTsModuleAsError: true,
} satisfies Options;

// swc only reads `transform` in "transform" mode, so these defaults are kept
// out of strip-only calls to avoid deserializing them on every call.
const DEFAULT_TRANSFORM_OPTIONS = {
	mode: "transform",
	deprecatedTsModuleAsError: true,
	transform: {
		verbatimModuleSyntax: true,
		nativeClassProperties: true,
		noEmptyExport: true,
		importNotUsedAsValues: "preserve",
	},
} satisfies Options;

export function transformSync(
	source: string,
	options?: Options,
): TransformOutput {
	// Ensure that the source code is a string
	const input = `${source ?? ""}`;
	const defaults =
		options?.mode === "transform" ? DEFAULT_TRANSFORM_OPTIONS : DEFAULT_OPTIONS;
	return swc.transformSync(input, { ...defaults, ...options });
}

export function transformModuleSyntax(
	source: string,
): ModuleSyntaxTransformOutput {
	return swc.transformModuleSyntax(`${source ?? ""}`);
}

export function getFirstExpression(
	source: string,
	startColumn: number,
): string {
	return swc.getFirstExpression(`${source ?? ""}`, startColumn);
}

export function isValidSyntax(source: string): boolean {
	return swc.isValidSyntax(`${source ?? ""}`);
}

export function isRecoverableError(source: string): boolean {
	return swc.isRecoverableError(`${source ?? ""}`);
}
