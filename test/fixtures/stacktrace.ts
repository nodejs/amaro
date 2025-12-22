enum Foo {
	A = "Hello, TypeScript!",
}

// Allow warnings about source maps to be shown for testing purposes.
setImmediate(() => {
  throw new Error(Foo.A);
});
