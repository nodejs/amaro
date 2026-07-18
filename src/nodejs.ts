import type { ModuleSyntaxTransformOutput } from "../lib/wasm";
import swc from "../lib/wasm.js";

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
