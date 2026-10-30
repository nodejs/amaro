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

    validate(&input, &options, strip_options, &mut diagnostics);
    report(cm, handler, &input, &options, diagnostics)?;

    Ok(TransformOutput {
        code: output.code.into_owned(),
    })
}

fn validate(
    input: &str,
    options: &Options,
    strip_options: StripOptions,
    diagnostics: &mut Vec<swc_next_type_strip::Diagnostic<'static>>,
) {
    // Keep Amaro's restriction on the deprecated identifier-named `module`
    // declaration. String-named ambient modules remain supported.
    let reject_deprecated_modules =
        options.deprecated_ts_module_as_error.unwrap_or_default() && input.contains("module");
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
}
