import type {
	ModuleSyntaxTransformOutput,
	Token,
	TokenKind,
	TopLevelAwaitLocation,
} from "../lib/wasm";
import swc from "../lib/wasm.js";

export type { Token, TokenKind, TopLevelAwaitLocation };

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

export function tokenize(source: string): Token[] {
	return swc.tokenize(`${source ?? ""}`);
}

export function findTopLevelAwaits(source: string): TopLevelAwaitLocation[] {
	return swc.findTopLevelAwaits(`${source ?? ""}`);
}
