const message: string = "Hello from ESM TypeScript!";

export function greet(name: string): void {
    console.log(`${message} - ${name}`);
}

greet("Test");
