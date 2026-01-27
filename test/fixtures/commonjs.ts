const message: string = "Hello from CommonJS TypeScript!";

function greet(name: string): void {
    console.log(`${message} - ${name}`);
}

module.exports = { greet };

greet("Test");
