const message: string = "Hello, TypeScript!";

setImmediate(() => {
  throw new Error(message);
});
