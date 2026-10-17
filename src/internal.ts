import type {
	ModuleSyntaxTransformOutput,
	Options,
	TransformOutput,
} from "../lib/wasm";
import swc from "../lib/wasm.js";

const DEFAULT_OPTIONS = {
	mode: "strip-only",
	deprecatedTsModuleAsError: true,
	// default transform will only work when mode is "transform"
	transform: {
		verbatimModuleSyntax: true,
		nativeClassProperties: true,
		noEmptyExport: true,
		importNotUsedAsValues: "preserve",
	},
} as Options;

const STRIP_ONLY_DEFAULT_OPTIONS = {
	mode: DEFAULT_OPTIONS.mode,
	deprecatedTsModuleAsError: DEFAULT_OPTIONS.deprecatedTsModuleAsError,
} as Options;

export function transformSync(
	source: string,
	options?: Options,
): TransformOutput {
	// Ensure that the source code is a string
	const input = `${source ?? ""}`;
	const mode = options?.mode ?? DEFAULT_OPTIONS.mode;
	// `transform` is only read in "transform" mode; leaving it out in
	// "strip-only" mode saves deserializing it on every call.
	return swc.transformSync(input, {
		...(mode === "strip-only" ? STRIP_ONLY_DEFAULT_OPTIONS : DEFAULT_OPTIONS),
		...options,
	});
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
