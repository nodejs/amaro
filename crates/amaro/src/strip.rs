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
use swc_next_type_strip::{strip_types, Diagnostic, Lang, Options as StripOptions, SourceType};

const BOM: char = '\u{feff}';

/// Amaro error code of a diagnostic.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ErrorCode {
    InvalidSyntax,
    UnsupportedSyntax,
}

impl ErrorCode {
    fn as_str(self) -> &'static str {
        match self {
            Self::InvalidSyntax => "InvalidSyntax",
            Self::UnsupportedSyntax => "UnsupportedSyntax",
        }
    }

    /// Classifies a `strip_types` diagnostic. Only the `erasableSyntaxOnly`
    /// diagnostic reports valid TypeScript that needs code generation.
    fn of_strip_diagnostic(diagnostic: &Diagnostic<'_>) -> Self {
        if diagnostic.message.contains("erasableSyntaxOnly") {
            Self::UnsupportedSyntax
        } else {
            Self::InvalidSyntax
        }
    }
}

pub fn operate(
    cm: &Lrc<SourceMap>,
    handler: &Handler,
    mut input: String,
    options: Options,
) -> anyhow::Result<TransformOutput> {
    // `SourceMap::new_source_file` removes a leading BOM, so diagnostic
    // offsets are only valid for text without it. A BOM before a hashbang
    // also makes the output invalid JavaScript. `swc_ts_fast_strip` removed
    // it from the output too.
    if input.starts_with(BOM) {
        input.drain(..BOM.len_utf8());
    }

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
    let mut diagnostics: Vec<_> = output
        .diagnostics
        .into_iter()
        .map(|diagnostic| (ErrorCode::of_strip_diagnostic(&diagnostic), diagnostic))
        .collect();

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
    diagnostics: &mut Vec<(ErrorCode, Diagnostic<'static>)>,
) {
    // Keep Amaro's restriction on the deprecated identifier-named `module`
    // declaration. String-named ambient modules remain supported.
    let reject_deprecated_modules = options.deprecated_ts_module_as_error.unwrap_or_default()
        && needs_deprecated_module_check(input, stripped, !diagnostics.is_empty());
    // SWC Next accepts import and export declarations in scripts, so check
    // them here.
    if reject_deprecated_modules || options.module == Some(false) {
        let allocator = Allocator::default();
        let parsed =
            Parser::init(&allocator, input, strip_options.into(), NoTokenParserConfig).parse();
        if parsed.diagnostics.is_empty() {
            if options.module == Some(false) {
                for statement in parsed.ast.root_program().body(&parsed.ast).iter() {
                    let statement = parsed.ast.get_node_in_sub_range(statement);
                    if statement.is_module_indicator(&parsed.ast) {
                        diagnostics.push((
                            ErrorCode::InvalidSyntax,
                            Diagnostic::error(
                                "Import and export declarations are not allowed in scripts",
                                statement.span(&parsed.ast),
                            ),
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
                    diagnostics.push((
                        ErrorCode::UnsupportedSyntax,
                        Diagnostic::error(
                            "`module` keyword is not supported. Use `namespace` instead.",
                            span,
                        ),
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
    mut diagnostics: Vec<(ErrorCode, Diagnostic<'_>)>,
) -> anyhow::Result<()> {
    if diagnostics.is_empty() {
        return Ok(());
    }

    // Callers report the first diagnostic, so keep source order across the
    // `strip_types` diagnostics and the ones added by `validate`.
    diagnostics.sort_by_key(|(_, diagnostic)| (diagnostic.span.start, diagnostic.span.end));

    let filename = options
        .filename
        .clone()
        .map_or(FileName::Anon, |name| FileName::Real(name.into()));
    let file = cm.new_source_file(filename.into(), input.to_owned());
    debug_assert_eq!(file.src.len(), input.len());
    // Snippet rendering slices the source and panics, which aborts in
    // WebAssembly, if a span does not fall on character boundaries.
    let position = |offset: u32, round_up: bool| {
        let offset = (offset as usize).min(input.len());
        let offset = if round_up {
            input.ceil_char_boundary(offset)
        } else {
            input.floor_char_boundary(offset)
        };
        BytePos(file.start_pos.0 + offset as u32)
    };
    for (code, diagnostic) in diagnostics {
        let lo = position(diagnostic.span.start, false);
        let hi = position(diagnostic.span.end, true).max(lo);
        handler
            .struct_span_err(Span::new(lo, hi), diagnostic.message.as_ref())
            .code(DiagnosticId::Error(code.as_str().into()))
            .emit();
    }
    anyhow::bail!("TypeScript processing failed")
}

/// Returns `false` only when `input` cannot contain an identifier-named
/// `module` declaration, so the second parse in [`validate`] can be skipped.
///
/// `stripped` is the successful `strip_types` output for `input`. It is used
/// only when `strip_types` reported no diagnostics. `strip_types` erases
/// every `module` declaration as a whole statement, so only a `module` word
/// that was erased can be a declaration keyword.
fn needs_deprecated_module_check(input: &str, stripped: &str, has_diagnostics: bool) -> bool {
    let bytes = input.as_bytes();
    let is_candidate = |start| is_deprecated_module_candidate(bytes, start);
    if has_diagnostics {
        return input
            .match_indices("module")
            .any(|(start, _)| is_candidate(start));
    }
    find_erased_module_word(bytes, stripped.as_bytes(), is_candidate)
}

/// Calls `is_candidate` with the byte offset of each `module` word in `input`
/// that `output` erases or replaces, until it returns `true`.
///
/// `strip_types` keeps every UTF-16 offset. An ASCII character becomes one
/// output byte. A non-ASCII character is either kept or replaced by one ASCII
/// byte per UTF-16 unit. Identical words are skipped eight bytes at a time.
/// Returns `true` if `is_candidate` returns `true` or if the texts do not
/// correspond as expected.
fn find_erased_module_word(
    input: &[u8],
    output: &[u8],
    mut is_candidate: impl FnMut(usize) -> bool,
) -> bool {
    const M: u64 = 0x6d6d_6d6d_6d6d_6d6d;

    let (mut i, mut j) = (0, 0);
    loop {
        if i + 8 <= input.len() && j + 8 <= output.len() {
            let (a, b) = (word(input, i), word(output, j));
            if a == b {
                i += 8;
                j += 8;
                while i + 32 <= input.len() && j + 32 <= output.len() {
                    let diff = (word(input, i) ^ word(output, j))
                        | (word(input, i + 8) ^ word(output, j + 8))
                        | (word(input, i + 16) ^ word(output, j + 16))
                        | (word(input, i + 24) ^ word(output, j + 24));
                    if diff != 0 {
                        break;
                    }
                    i += 32;
                    j += 32;
                }
                continue;
            }
            if (a | b) & HIGH_BITS == 0 {
                // ASCII bytes correspond one to one. Check each changed `m`.
                let mut m = zero_bytes(a ^ M) & !zero_bytes(a ^ b);
                while m != 0 {
                    let start = i + m.trailing_zeros() as usize / 8;
                    m &= m - 1;
                    if input[start..].starts_with(b"module") && is_candidate(start) {
                        return true;
                    }
                }
                i += 8;
                j += 8;
                continue;
            }
        }

        let Some(&c) = input.get(i) else {
            return j != output.len();
        };
        let Some(&d) = output.get(j) else {
            return true;
        };
        if c < 0x80 {
            if c == b'm' && d != b'm' && input[i..].starts_with(b"module") && is_candidate(i) {
                return true;
            }
            i += 1;
            j += 1;
        } else {
            let len = match c {
                0xf0.. => 4,
                0xe0.. => 3,
                _ => 2,
            };
            let end = (i + len).min(input.len());
            j += if output[j..].starts_with(&input[i..end]) {
                end - i
            } else {
                1 + usize::from(c >= 0xf0)
            };
            i = end;
        }
    }
}

const HIGH_BITS: u64 = 0x8080_8080_8080_8080;

/// Sets the high bit of each zero byte in `x`.
#[inline(always)]
fn zero_bytes(x: u64) -> u64 {
    const LOW_BITS: u64 = !HIGH_BITS;
    // Only zero bytes keep the high bit clear after this addition.
    !(((x & LOW_BITS) + LOW_BITS) | x) & HIGH_BITS
}

#[inline(always)]
fn word(bytes: &[u8], at: usize) -> u64 {
    u64::from_le_bytes(bytes[at..at + 8].try_into().unwrap())
}

/// Returns whether the `module` word at `start` may start an
/// identifier-named `module` declaration.
///
/// A declaration needs a name after `module`. Common non-declaration uses
/// such as `module.exports`, `"node:module"`, and `declare module "pkg"` are
/// followed by punctuation or a quote and are skipped. A declaration also
/// starts a statement, so prose such as `its module graph` is skipped. Other
/// prose and non-ASCII neighbors are conservatively kept as candidates.
fn is_deprecated_module_candidate(bytes: &[u8], start: usize) -> bool {
    const KEYWORD: &[u8] = b"module";
    debug_assert!(bytes[start..].starts_with(KEYWORD));

    if start > 0 && is_ident_part(bytes[start - 1]) {
        return false;
    }
    let mut i = start + KEYWORD.len();
    if bytes.get(i).is_some_and(|&b| is_ident_part(b)) {
        return false;
    }
    if !may_start_statement(bytes, start) {
        return false;
    }

    // Skip whitespace and comments between `module` and the next token.
    loop {
        match bytes.get(i..) {
            Some([b' ' | b'\t' | b'\n' | b'\r' | b'\x0b' | b'\x0c', ..]) => i += 1,
            Some([b'/', b'*', rest @ ..]) => {
                i = rest
                    .windows(2)
                    .position(|w| w == b"*/")
                    .map_or(bytes.len(), |end| i + 2 + end + 2);
            }
            Some([b'/', b'/', rest @ ..]) => {
                i = rest
                    .iter()
                    .position(|&b| matches!(b, b'\n' | b'\r'))
                    .map_or(bytes.len(), |end| i + 2 + end);
            }
            _ => break,
        }
    }

    bytes.get(i).is_some_and(|&next| {
        next.is_ascii_alphabetic() || matches!(next, b'_' | b'$' | b'\\') || next >= 0x80
    })
}

fn is_ident_part(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'$'
}

/// Returns whether a `module` word at `start` can begin a statement.
///
/// A statement cannot directly follow a word on the same line, except a
/// keyword that introduces a statement or declaration. Any other preceding
/// character, a line break, or a word that may contain an escape or a
/// non-ASCII character keeps the candidate.
fn may_start_statement(bytes: &[u8], start: usize) -> bool {
    let mut end = start;
    while end > 0 && matches!(bytes[end - 1], b' ' | b'\t') {
        end -= 1;
    }
    let mut word_start = end;
    while word_start > 0 && is_ident_part(bytes[word_start - 1]) {
        word_start -= 1;
    }
    if word_start == end || (word_start > 0 && matches!(bytes[word_start - 1], b'\\' | 0x80..)) {
        return true;
    }
    matches!(
        &bytes[word_start..end],
        b"export" | b"declare" | b"default" | b"else" | b"do"
    )
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
    fn removes_a_leading_bom() {
        let result = strip("\u{feff}const value: number = 1;", Options::default())
            .unwrap_or_else(|_| panic!("strip failed"));
        assert_eq!(result.code, "const value         = 1;");

        // A BOM before a hashbang is not valid JavaScript.
        let result = strip(
            "\u{feff}#!/usr/bin/env node\nconst value: number = 1;",
            Options::default(),
        )
        .unwrap_or_else(|_| panic!("strip failed"));
        assert_eq!(result.code, "#!/usr/bin/env node\nconst value         = 1;");

        // Diagnostics use positions in the text after the BOM.
        let errors = strip("\u{feff}enum Value { A }", Options::default())
            .err()
            .unwrap();
        assert_eq!(errors[0].code.as_deref(), Some("UnsupportedSyntax"));
        assert_eq!(errors[0].start_column, Some(0));

        // An offset shifted by the BOM must not split a character.
        let source = "const value = '\u{1d4b3}' }";
        let errors = strip(&format!("\u{feff}{source}"), Options::default())
            .err()
            .unwrap();
        let expected = strip(source, Options::default()).err().unwrap();
        assert_eq!(errors[0].code.as_deref(), Some("InvalidSyntax"));
        assert_eq!(errors[0].start_line, expected[0].start_line);
        assert_eq!(errors[0].start_column, expected[0].start_column);
        assert_eq!(errors[0].end_column, expected[0].end_column);
    }

    #[test]
    fn reports_the_first_error_in_source_order() {
        let options = Options {
            deprecated_ts_module_as_error: Some(true),
            ..Default::default()
        };
        let errors = strip(
            "module Types { export type A = 1 }\nenum Value { A }",
            options,
        )
        .err()
        .unwrap();
        assert_eq!(errors.len(), 2);
        assert_eq!(errors[0].start_line, Some(1));
        assert!(errors[0].message.starts_with("`module` keyword"));
        assert_eq!(errors[1].start_line, Some(2));

        let options = Options {
            module: Some(false),
            ..Default::default()
        };
        let errors = strip("import value from 'value';\nenum Value { A }", options)
            .err()
            .unwrap();
        assert_eq!(errors.len(), 2);
        assert_eq!(errors[0].code.as_deref(), Some("InvalidSyntax"));
        assert_eq!(errors[0].start_line, Some(1));
        assert_eq!(errors[1].code.as_deref(), Some("UnsupportedSyntax"));
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

    fn has_candidate(source: &str) -> bool {
        source
            .match_indices("module")
            .any(|(start, _)| is_deprecated_module_candidate(source.as_bytes(), start))
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
            "const a = 1\nmodule Foo {}",
            "export declare module Foo {}",
            "if (a) {} else module Foo {}",
            "do module Foo {} while (a)",
            "/* c */ module Foo {}",
            "naïve module Foo",
            "\\u0061 module Foo",
            // Prose can trigger the parse; the parser makes the final decision.
            "// module handles requests",
            " * module graph",
        ] {
            assert!(has_candidate(source), "{source:?}");
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
            "// this module handles requests",
            "/** its module dependency graph */",
            "namespace module {}",
            "const a = 1; type module = string",
            "x\tmodule Foo",
        ] {
            assert!(!has_candidate(source), "{source:?}");
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
            // A word before `module` rules out a declaration, even when an
            // erased statement erases the comment.
            "interface A {\n  /** its module dependency */\n  x: number\n}",
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
    fn finds_erased_module_words() {
        let filler = "const pad = 1;".repeat(5);
        for source in [
            String::new(),
            "module Foo { export type A = 1 }".into(),
            "const value: '😀é€' = 1;\nmodule Foo { export type A = 1 }".into(),
            "interface A { x: '😀'; /* module y */ }\nconst s = 'module'; // module z".into(),
            format!("{filler}type T = 'é';{filler}\nmodule A {{}}{filler}// module x\n"),
            format!("{filler}let v: '𝕏' = 1; module.exports = v;{filler}declare module B {{}}"),
            format!("{filler}interface I {{ /** its module é graph */ x: 1 }}{filler}"),
            "let mmodule = module;\n".repeat(9),
        ] {
            let output = strip_types(
                &source,
                StripOptions {
                    source_type: SourceType::Unambiguous,
                    lang: Lang::Ts,
                },
            );
            assert!(output.diagnostics.is_empty(), "{source:?}");
            let output_units: Vec<u16> = output.code.encode_utf16().collect();
            let module_units: Vec<u16> = "module".encode_utf16().collect();
            let expected: Vec<usize> = source
                .match_indices("module")
                .map(|(start, _)| start)
                .filter(|&start| {
                    let at = source[..start].encode_utf16().count();
                    !output_units[at..].starts_with(&module_units)
                })
                .collect();

            let mut found = Vec::new();
            let stopped =
                find_erased_module_word(source.as_bytes(), output.code.as_bytes(), |start| {
                    found.push(start);
                    false
                });
            assert!(!stopped, "{source:?}");
            assert_eq!(found, expected, "{source:?}");
        }

        // Texts that do not correspond keep the check.
        assert!(find_erased_module_word(b"ab", "😀".as_bytes(), |_| false));
        assert!(find_erased_module_word(b"abc", b"ab", |_| false));
        assert!(find_erased_module_word(b"ab", b"abc", |_| false));
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
            "const a = 1\nmodule Foo { export type A = 1 }",
            "export declare module Foo { export type A = 1 }",
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
            "namespace module { export type A = 1 }",
        ] {
            assert_eq!(code(source), None, "{source:?}");
        }
    }
}
