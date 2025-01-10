type SwcError = {
	code: "UnsupportedSyntax" | "InvalidSyntax";
	message: string;
};

// Type guard to check if error is SwcError
export function isSwcError(error: unknown): error is SwcError {
	return (error as SwcError).code !== undefined;
}

// Since swc throw an object, we need to wrap it in a proper error
export function wrapAndReThrowSwcError(error: SwcError): never {
	switch (error.code) {
		case "UnsupportedSyntax": {
			const unsupportedSyntaxError = new Error(error.message);
			unsupportedSyntaxError.name = "UnsupportedSyntaxError";
			throw unsupportedSyntaxError;
		}
		case "InvalidSyntax":
			throw new SyntaxError(error.message);
		default:
			throw new Error(error.message);
	}
}
