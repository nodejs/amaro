# Amaro

Amaro is a wrapper around `@swc/wasm-typescript`, a WebAssembly port of the SWC TypeScript parser.
It's currently used as an internal in Node.js for [Type Stripping](https://github.com/nodejs/loaders/issues/208), but in the future it will be possible to be upgraded separately by users.
The main goal of this package is to provide a stable API for TypeScript parser, which is unstable and subject to change.

> Amaro means "bitter" in Italian. It's a reference to [Mount Amaro](https://en.wikipedia.org/wiki/Monte_Amaro_(Abruzzo)) on whose slopes this package was conceived.

## How to Install

To install Amaro, run:

```shell
npm install amaro
```

## How to Use

By default Amaro exports a `transformSync` function that performs type stripping.
Stack traces are preserved, by replacing removed types with white spaces.

```javascript
const amaro = require('amaro');
const { code } = amaro.transformSync("const foo: string = 'bar';", { mode: "strip-only" });
console.log(code); // "const foo         = 'bar';"
```

### Loader

It is possible to use Amaro as an external loader to execute TypeScript files.
This allows the installed Amaro to override the Amaro version used by Node.js.
In order to use Amaro as an external loader, type stripping needs to be enabled.

```bash
node --experimental-strip-types --import="amaro/register" script.ts
```

Or with the alias:

```bash
node --experimental-strip-types --import="amaro/strip" script.ts
```

Enabling TypeScript feature transformation:

```bash
node --experimental-transform-types --import="amaro/transform" script.ts
```

> Note that the "amaro/transform" loader should be used with `--experimental-transform-types` flag, or
> at least with `--enable-source-maps` flag, to preserve the original source maps.

#### Type stripping in dependencies
Contrary to the Node.js [TypeScript support](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping-in-dependencies), when used as a loader, Amaro handles TypeScript files inside folders under a node_modules path. When used with the [`--conditions`](https://nodejs.org/docs/latest-v24.x/api/cli.html#-c-condition---conditionscondition) flag, it is very useful in development, specifically in monorepos.

Adding a reference to TypeScript source files in the exports field of a package
```json
"exports": {
  ".": {
    "typescript": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "require": "./dist/index.js",
    "import": "./dist/index.js"
 }
}
```
and running the applications using the Node.js' watch mode with `--conditions` set as in
`node --watch --import="amaro/register" --conditions=typescript ./src/index.ts`

allows the loader to automatically resolve and process TypeScript files from linked packages without requiring a build step. Whenever a source code change occurs in the app or an internal package, the Node.js process will restart and reload the updated TypeScript code directly, enabling rapid development iterations across the entire monorepo.

### TypeScript Version

The supported TypeScript version is 5.8.

## License (MIT)

See [`LICENSE.md`](./LICENSE.md).
