type SwcError = {
	code: "UnsupportedSyntax" | "InvalidSyntax";
	message: string;
	column: number;
	line: number;
	snippet: string;
	filename: string;
};

// Type guard to check if error is SwcError
export function isSwcError(error: unknown): error is SwcError {
	return (error as SwcError).code !== undefined;
}

// Since swc throw an object, we need to wrap it in a proper error
export function wrapAndReThrowSwcError(error: SwcError): never {
	const errorHints = `${error.filename}:${error.line}\n${error.snippet}\n`;
	switch (error.code) {
		case "UnsupportedSyntax": {
			const unsupportedSyntaxError = new Error(error.message);
			unsupportedSyntaxError.name = "UnsupportedSyntaxError";
			unsupportedSyntaxError.stack = `${errorHints}\n${unsupportedSyntaxError.stack}`;
			throw unsupportedSyntaxError;
		}
		case "InvalidSyntax": {
			const syntaxError = new SyntaxError(error.message);
			syntaxError.stack = `${errorHints}\n${syntaxError.stack}`;
			throw syntaxError;
		}
		default:
			throw new Error(error.message);
	}
}
