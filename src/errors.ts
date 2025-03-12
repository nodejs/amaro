type SwcError = {
	code: "UnsupportedSyntax" | "InvalidSyntax";
	message: string;
	startColumn: number;
	startLine: number;
	snippet: string;
	filename: string;
	endColumn: number;
	endLine: number;
};

// Type guard to check if error is SwcError
export function isSwcError(error: unknown): error is SwcError {
	return (error as SwcError).code !== undefined;
}

// Since swc throw an object, we need to wrap it in a proper error
export function wrapAndReThrowSwcError(error: SwcError): never {
	const errorHints = `${error.filename}:${error.startLine}${error.snippet}`;
	switch (error.code) {
		case "UnsupportedSyntax": {
			const unsupportedSyntaxError = new Error(error.message);
			unsupportedSyntaxError.name = "UnsupportedSyntaxError";
			unsupportedSyntaxError.stack = `${errorHints}${unsupportedSyntaxError.stack}`;
			throw unsupportedSyntaxError;
		}
		case "InvalidSyntax": {
			const syntaxError = new SyntaxError(error.message);
			syntaxError.stack = `${errorHints}${syntaxError.stack}`;
			throw syntaxError;
		}
		default:
			throw new Error(error.message);
	}
}
