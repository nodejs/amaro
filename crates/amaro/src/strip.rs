//! SWC Next adapter for fixed-width TypeScript stripping.

use crate::options::{Options, TransformOutput};
use swc_common::{
    errors::{DiagnosticId, Handler},
    sync::Lrc,
    BytePos, FileName, SourceMap, Span,
};
use swc_next_allocator::Allocator;
use swc_next_ecma_ast::{
    Ast, GetSpan, TsModuleDeclaration, TsModuleDeclarationKind, Visit, VisitWith,
};
use swc_next_ecma_parser::{NoTokenParserConfig, Parser};
use swc_next_type_strip::{strip_types, Lang, Options as StripOptions, SourceType};

pub fn operate(
    cm: &Lrc<SourceMap>,
    handler: &Handler,
    input: String,
    options: Options,
) -> anyhow::Result<TransformOutput> {
    let strip_options = StripOptions {
        source_type: match options.module {
            Some(true) => SourceType::Module,
            Some(false) => SourceType::Script,
            None => SourceType::Unambiguous,
        },
        lang: if options.parser.tsx {
            Lang::Tsx
        } else {
            Lang::Ts
        },
    };
    let output = strip_types(&input, strip_options);
    let mut diagnostics = output.diagnostics;

    validate(
        &input,
        &output.code,
        &options,
        strip_options,
        &mut diagnostics,
    );
    report(cm, handler, &input, &options, diagnostics)?;

    Ok(TransformOutput {
        code: output.code.into_owned(),
    })
}

fn validate(
    input: &str,
    stripped: &str,
    options: &Options,
    strip_options: StripOptions,
    diagnostics: &mut Vec<swc_next_type_strip::Diagnostic<'static>>,
) {
    // Keep Amaro's restriction on the deprecated identifier-named `module`
    // declaration. String-named ambient modules remain supported.
    let reject_deprecated_modules = options.deprecated_ts_module_as_error.unwrap_or_default()
        && needs_deprecated_module_check(input, stripped, !diagnostics.is_empty());
    if reject_deprecated_modules || options.module == Some(false) {
        let allocator = Allocator::default();
        let parsed = Parser::init(
            &allocator,
            &input,
            strip_options.into(),
            NoTokenParserConfig,
        )
        .parse();
        if parsed.diagnostics.is_empty() {
            if options.module == Some(false) {
                for statement in parsed.ast.root_program().body(&parsed.ast).iter() {
                    let statement = parsed.ast.get_node_in_sub_range(statement);
                    if statement.is_module_indicator(&parsed.ast) {
                        diagnostics.push(swc_next_type_strip::Diagnostic::error(
                            "Import and export declarations are not allowed in scripts",
                            statement.span(&parsed.ast),
                        ));
                    }
                }
            }
            if reject_deprecated_modules {
                let mut collector = DeprecatedModules {
                    ast: &parsed.ast,
                    spans: Vec::new(),
                };
                parsed.ast.root_program().visit_with(&mut collector);
                for span in collector.spans {
                    diagnostics.push(swc_next_type_strip::Diagnostic::error(
                        "`module` keyword is not supported. Use `namespace` instead.",
                        span,
                    ));
                }
            }
        }
    }
}

fn report(
    cm: &Lrc<SourceMap>,
    handler: &Handler,
    input: &str,
    options: &Options,
    diagnostics: Vec<swc_next_type_strip::Diagnostic<'_>>,
) -> anyhow::Result<()> {
    if !diagnostics.is_empty() {
        let filename = options
            .filename
            .clone()
            .map_or(FileName::Anon, |name| FileName::Real(name.into()));
        let file = cm.new_source_file(filename.into(), input.to_owned());
        for diagnostic in diagnostics {
            let unsupported = diagnostic.message.contains("erasableSyntaxOnly")
                || diagnostic.message.starts_with("`module` keyword")
                || diagnostic
                    .message
                    .starts_with("Unsupported transform option");
            let span = Span::new(
                BytePos(file.start_pos.0 + diagnostic.span.start),
                BytePos(file.start_pos.0 + diagnostic.span.end),
            );
            handler
                .struct_span_err(span, diagnostic.message.as_ref())
                .code(DiagnosticId::Error(
                    if unsupported {
                        "UnsupportedSyntax"
                    } else {
                        "InvalidSyntax"
                    }
                    .into(),
                ))
                .emit();
        }
        anyhow::bail!("TypeScript processing failed");
    }

    Ok(())
}

/// Returns `false` only when `input` cannot contain an identifier-named
/// `module` declaration, so the second parse in [`validate`] can be skipped.
///
/// `stripped` is the successful `strip_types` output for `input`. It is used
/// only when `strip_types` reported no diagnostics. `strip_types` erases
/// every `module` declaration as a whole statement, so a declaration keyword
/// cannot survive unchanged in that output. A candidate that is still
/// `module` in the output is in a comment, a string, or an expression.
fn needs_deprecated_module_check(input: &str, stripped: &str, has_diagnostics: bool) -> bool {
    let mut candidates = deprecated_module_candidates(input).peekable();
    if candidates.peek().is_none() {
        return false;
    }
    if has_diagnostics {
        return true;
    }

    let mut offsets = Utf16OffsetMapper::new(input, stripped);
    candidates.any(|start| match offsets.map(start) {
        Some(start) => !stripped[start..].starts_with("module"),
        None => true,
    })
}

/// Returns the byte offsets of every `module` word that may start an
/// identifier-named `module` declaration.
///
/// A declaration needs a name after `module`. Common non-declaration uses
/// such as `module.exports`, `"node:module"`, and `declare module "pkg"` are
/// followed by punctuation or a quote and are skipped. Prose in comments or
/// strings and non-ASCII neighbors are conservatively kept as candidates.
fn deprecated_module_candidates(input: &str) -> impl Iterator<Item = usize> + '_ {
    const KEYWORD: &str = "module";
    let bytes = input.as_bytes();
    let is_ident_part = |b: u8| b.is_ascii_alphanumeric() || b == b'_' || b == b'$';

    input.match_indices(KEYWORD).filter_map(move |(start, _)| {
        if start > 0 && is_ident_part(bytes[start - 1]) {
            return None;
        }

        let mut i = start + KEYWORD.len();
        if bytes.get(i).is_some_and(|&b| is_ident_part(b)) {
            return None;
        }

        // Skip whitespace and comments between `module` and the next token.
        loop {
            match bytes.get(i..) {
                Some([b' ' | b'\t' | b'\n' | b'\r' | b'\x0b' | b'\x0c', ..]) => i += 1,
                Some([b'/', b'*', ..]) => {
                    i = input[i + 2..]
                        .find("*/")
                        .map_or(bytes.len(), |end| i + 2 + end + 2);
                }
                Some([b'/', b'/', ..]) => {
                    i = input[i + 2..]
                        .find(['\n', '\r'])
                        .map_or(bytes.len(), |end| i + 2 + end);
                }
                _ => break,
            }
        }

        let next = *bytes.get(i)?;
        (next.is_ascii_alphabetic() || matches!(next, b'_' | b'$' | b'\\') || next >= 0x80)
            .then_some(start)
    })
}

/// Maps ascending byte offsets in the input to byte offsets in the stripped
/// output. `strip_types` preserves UTF-16 offsets, but byte offsets move
/// when erased text contains non-ASCII characters.
struct Utf16OffsetMapper<'a> {
    input: &'a str,
    output: &'a str,
    input_pos: usize,
    output_pos: usize,
}

impl<'a> Utf16OffsetMapper<'a> {
    fn new(input: &'a str, output: &'a str) -> Self {
        Self {
            input,
            output,
            input_pos: 0,
            output_pos: 0,
        }
    }

    /// Returns `None` if the offset has no matching character boundary in
    /// the output.
    fn map(&mut self, input_offset: usize) -> Option<usize> {
        let segment = self.input.as_bytes().get(self.input_pos..input_offset)?;
        let units = utf16_len(segment);
        self.input_pos = input_offset;

        let output = self.output.as_bytes();
        let mut pos = self.output_pos;
        let mut seen = 0;
        // Skip whole chunks first; the byte walk below finds the boundary.
        for chunk in output[pos..].chunks(64) {
            let chunk_units = utf16_len(chunk);
            if seen + chunk_units >= units {
                break;
            }
            seen += chunk_units;
            pos += chunk.len();
        }
        while let Some(&b) = output.get(pos) {
            if is_utf8_lead(b) {
                if seen == units {
                    break;
                }
                seen += utf16_units(b);
                if seen > units {
                    return None;
                }
            }
            pos += 1;
        }
        if seen != units {
            return None;
        }

        self.output_pos = pos;
        Some(pos)
    }
}

/// Returns the UTF-16 length of UTF-8 `bytes`, counting a character in the
/// chunk where its first byte is.
fn utf16_len(bytes: &[u8]) -> usize {
    const HIGH_BITS: u64 = 0x8080_8080_8080_8080;
    let (words, rest) = bytes.as_chunks::<8>();
    let mut units = 0;
    for word in words {
        let w = u64::from_le_bytes(*word);
        if w & HIGH_BITS == 0 {
            units += 8;
            continue;
        }
        // Continuation bytes are `10xxxxxx`; four-byte leads are `11110xxx`
        // and need a surrogate pair.
        let continuation = w & !(w << 1) & HIGH_BITS;
        let four_byte_lead = w & (w << 1) & (w << 2) & (w << 3) & HIGH_BITS;
        units += 8 - continuation.count_ones() as usize + four_byte_lead.count_ones() as usize;
    }
    units + rest.iter().map(|&b| utf16_units(b)).sum::<usize>()
}

/// Returns whether `b` starts a UTF-8 encoded character.
fn is_utf8_lead(b: u8) -> bool {
    (b as i8) >= -0x40
}

/// Returns the UTF-16 length of the character that starts with `b`, or 0 for
/// a continuation byte.
fn utf16_units(b: u8) -> usize {
    usize::from(is_utf8_lead(b)) + usize::from(b >= 0xf0)
}

struct DeprecatedModules<'ast> {
    ast: &'ast Ast<'ast>,
    spans: Vec<swc_next_type_strip::Span>,
}

impl<'ast> Visit<'ast> for DeprecatedModules<'ast> {
    fn ast(&self) -> &Ast<'ast> {
        self.ast
    }

    fn visit_ts_module_declaration(&mut self, node: TsModuleDeclaration) {
        if node.kind(self.ast) == TsModuleDeclarationKind::Module
            && !node.id(self.ast).is_string_literal(self.ast)
        {
            self.spans.push(node.span(self.ast));
        }
        node.visit_children_with(self);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strip(
        source: &str,
        options: Options,
    ) -> Result<TransformOutput, Vec<crate::JsonDiagnostic>> {
        let cm = Lrc::new(SourceMap::default());
        crate::try_with_json_handler(cm.clone(), |handler| {
            operate(&cm, handler, source.into(), options)
        })
    }

    #[test]
    fn preserves_source_positions() {
        let source = "const value: '😀' = 'ok';\r\nvalue;";
        let result = strip(source, Options::default()).unwrap_or_else(|_| panic!("strip failed"));
        assert_eq!(result.code, "const value       = 'ok';\r\nvalue;");
        assert_eq!(
            result.code.encode_utf16().count(),
            source.encode_utf16().count()
        );
    }

    #[test]
    fn reports_errors_without_returning_recovery_output() {
        let errors = strip("enum Value { A }", Options::default()).err().unwrap();
        assert_eq!(errors[0].code.as_deref(), Some("UnsupportedSyntax"));
        assert_eq!(errors[0].start_line, Some(1));

        let errors = strip("const value;", Options::default()).err().unwrap();
        assert_eq!(errors[0].code.as_deref(), Some("InvalidSyntax"));
    }

    #[test]
    fn forwards_module_and_filename_options() {
        let options = Options {
            module: Some(false),
            filename: Some("input.ts".into()),
            ..Default::default()
        };
        let errors = strip("export const value: number = 1;", options)
            .err()
            .unwrap();
        assert_eq!(errors[0].filename.as_deref(), Some("input.ts"));

        let options = Options {
            module: Some(true),
            ..Default::default()
        };
        assert!(strip("export const value: number = 1;", options).is_ok());
    }

    #[test]
    fn preserves_deprecated_module_option() {
        let source = "module Types { export type Value = number }";
        assert!(strip(source, Options::default()).is_ok());

        let options = Options {
            deprecated_ts_module_as_error: Some(true),
            ..Default::default()
        };
        let errors = strip(source, options).err().unwrap();
        assert_eq!(errors[0].code.as_deref(), Some("UnsupportedSyntax"));

        let options = Options {
            deprecated_ts_module_as_error: Some(true),
            ..Default::default()
        };
        assert!(strip(
            "declare module 'types' { export type Value = number }",
            options
        )
        .is_ok());
    }

    #[test]
    fn detects_possible_deprecated_modules() {
        for source in [
            "module Foo {}",
            "declare module Foo {}",
            "export module Foo {}",
            "namespace X { module Y {} }",
            "module A.B {}",
            "module /* comment */ Foo {}",
            "module // comment\nFoo {}",
            "module\nFoo {}",
            "module\u{a0}Foo {}",
            "module Ñ {}",
            "module \\u0046oo {}",
            "module _Foo {}",
            "module $Foo {}",
            "module.exports = 1; module Foo {}",
            // Prose can trigger the parse; the parser makes the final decision.
            "// this module handles requests",
        ] {
            assert!(
                deprecated_module_candidates(source).next().is_some(),
                "{source:?}"
            );
        }

        for source in [
            "",
            "const value = 1;",
            "module.exports = value;",
            "module",
            "module;",
            "module/* unterminated",
            "module // comment",
            "require('node:module');",
            "import { createRequire } from \"node:module\";",
            "declare module 'pkg' {}",
            "declare module \"pkg\" {}",
            "declare module `pkg` {}",
            "modules Foo {}",
            "submodule Foo {}",
            "module_name Foo",
            "fn(module, other)",
            "module: Foo",
            "import.meta.module = 1",
        ] {
            assert!(
                deprecated_module_candidates(source).next().is_none(),
                "{source:?}"
            );
        }
    }

    #[test]
    fn skips_the_module_check_for_surviving_candidates() {
        let needs_check = |source: &str| {
            let output = strip_types(
                source,
                StripOptions {
                    source_type: SourceType::Unambiguous,
                    lang: Lang::Ts,
                },
            );
            needs_deprecated_module_check(source, &output.code, !output.diagnostics.is_empty())
        };

        for source in [
            "// this module handles requests\nconst value: number = 1;",
            "/* the module Foo */ const value: number = 1;",
            "const message = 'module Foo';",
            "const value: '😀' = 1; // module handles this",
            "interface A { x: '😀' }\nconst s = `module ${1} x`; // module y",
            "module.exports = value;",
        ] {
            assert!(!needs_check(source), "{source:?}");
        }

        for source in [
            "module Foo { export type A = 1 }",
            "const value: '😀' = 1;\nmodule Foo { export type A = 1 }",
            "// module text\ninterface A { x: '😀😀' }\nmodule Foo { export type A = 1 }",
            // A comment inside an erased statement is erased too.
            "interface A {\n  // module handles this\n  x: number\n}",
            // Diagnostics keep the previous behavior.
            "enum E { A } // module handles this",
        ] {
            assert!(needs_check(source), "{source:?}");
        }
    }

    #[test]
    fn maps_offsets_across_erased_non_ascii_text() {
        let input = "a😀éb€c\nmodule x";
        let output = "a   b c\nmodule x";
        let mut mapper = Utf16OffsetMapper::new(input, output);
        for (from, to) in [
            (0, 0),
            (1, 1),
            (5, 3),
            (7, 4),
            (8, 5),
            (11, 6),
            (12, 7),
            (13, 8),
        ] {
            assert_eq!(mapper.map(from), Some(to), "{from}");
        }
        assert_eq!(mapper.map(input.len()), Some(output.len()));

        for text in ["", "abc", "a😀éb€c\n", &"x😀é€".repeat(20)] {
            assert_eq!(
                utf16_len(text.as_bytes()),
                text.encode_utf16().count(),
                "{text:?}"
            );
        }

        // Offsets inside a surrogate pair have no output boundary.
        assert_eq!(Utf16OffsetMapper::new("ab", "😀").map(1), None);
    }

    #[test]
    fn keeps_deprecated_module_errors_for_edge_cases() {
        let options = || Options {
            deprecated_ts_module_as_error: Some(true),
            ..Default::default()
        };
        let code = |source: &str| {
            strip(source, options())
                .err()
                .map(|errors| errors[0].code.clone().unwrap())
        };

        for source in [
            "module Foo { export type A = 1 }",
            "module /* c */ Foo { export type A = 1 }",
            "module A.B { export type A = 1 }",
            "declare module Foo { export type A = 1 }",
            "export module Foo { export type A = 1 }",
            "namespace X { module Y { export type A = 1 } }",
            "module Ñ { export type A = 1 }",
            "module \\u0046oo { export type A = 1 }",
            "module\u{a0}Foo { export type A = 1 }",
            "const value: '😀' = 1;\nmodule Foo { export type A = 1 }",
            "const value: '😀' = 1; // module x\nmodule Foo { export type A = 1 }",
            "module Foo { export const value = 1 }",
        ] {
            assert_eq!(
                code(source).as_deref(),
                Some("UnsupportedSyntax"),
                "{source:?}"
            );
        }

        for source in [
            "declare module \"foo\" { export type A = 1 }",
            "module.exports = 1; const m = require(\"node:module\");",
            "// this module handles requests\nconst value: number = 1;",
        ] {
            assert_eq!(code(source), None, "{source:?}");
        }
    }
}
