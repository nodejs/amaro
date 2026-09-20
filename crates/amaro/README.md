# amaro (Rust core)

This crate is the Rust side of [Amaro](https://github.com/nodejs/amaro). It
depends on published SWC crates for the lexer, parser, AST, visitor, and
TypeScript type stripping, and owns the Node.js-specific behavior on top of
them.

## API

- `transform` and `transformSync`: TypeScript type stripping via `swc_ts_fast_strip`
- `transformModuleSyntax`: rewrites REPL input using ESM syntax into script syntax
- `getFirstExpression`: locates the source expression for a V8 error column
- `isValidSyntax`: checks whether input parses
- `isRecoverableError`: decides whether the REPL should wait for more input

## Building

The crate is compiled to WebAssembly by `tools/build-wasm.js` from the
repository root, which runs `wasm-pack` inside the Node.js wasm-builder
container and copies the output into `lib/`.

To build locally without the container:

```sh
cd crates/amaro
wasm-pack build --out-name wasm --release --target nodejs
node ../../tools/patch-wasm.mjs pkg
```

## Updating SWC

Dependabot bumps the `swc_*` crates as one group. SWC publishes every crate
from a single monorepo release, so the group always lands on one consistent
set of versions. When a bump renames AST types, diff `src/` against
`bindings/binding_nodejs_support_wasm/src` at the new SWC tag to pick up the
matching changes.

## License

The Rust sources here originated in SWC's `binding_nodejs_support_wasm` crate
and remain under the Apache-2.0 license in `LICENSE`.
