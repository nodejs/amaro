//! TypeScript transformation through SWC Next's semantic analysis and printer.

use crate::options::{Options, TransformOutput};
use swc_common::{errors::Handler, sync::Lrc, SourceMap};
use swc_next_allocator::Allocator;
use swc_next_ecma_ast::{
    Argument, AssignmentOperator, AssignmentTarget, Ast, Expr, ExprData, GetSpan, Lang, SourceType,
    Span, Stmt, StmtData, VisitMut, VisitMutWith,
};
use swc_next_ecma_codegen::{print, Options as PrintOptions};
use swc_next_ecma_parser::{NoTokenParserConfig, Options as ParserOptions, Parser};
use swc_next_ecma_semantic::{analyze, AnalyzeOptions, SyntaxChecks};
use swc_next_ecma_transformer::{
    normalize::Normalizer, typescript::TypeScriptOptions, Transformer, TransformerOptions,
};

pub fn operate(
    cm: &Lrc<SourceMap>,
    handler: &Handler,
    input: String,
    options: Options,
) -> anyhow::Result<TransformOutput> {
    let allocator = Allocator::default();
    let parser_options = ParserOptions {
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
        ..Default::default()
    };
    let parsed = Parser::init(&allocator, &input, parser_options, NoTokenParserConfig).parse();
    let mut diagnostics = parsed.diagnostics;
    crate::strip::validate(&input, &options, parser_options.into(), &mut diagnostics);
    crate::strip::report(cm, handler, &input, &options, diagnostics)?;
    let mut ast = parsed.ast;
    Normalizer::normalize_runtime(ast.root_program(), &mut ast);
    let analyzed = analyze(
        &ast,
        AnalyzeOptions {
            // Amaro preserves resource declarations for Node to evaluate.
            check_syntax: SyntaxChecks::all() - SyntaxChecks::USING_DECLARATIONS,
        },
    );
    crate::strip::report(cm, handler, &input, &options, analyzed.diagnostics)?;

    let default_config = crate::options::TransformConfig::default();
    let config = options.transform.as_ref().unwrap_or(&default_config);
    let unsupported = if config.jsx.is_some() {
        Some("jsx")
    } else if !config.native_class_properties {
        Some("nativeClassProperties: false")
    } else if config.import_export_assign_config
        != crate::options::ImportExportAssignConfig::Classic
    {
        Some("importExportAssignConfig other than Classic")
    } else if config.ts_enum_is_mutable && !config.verbatim_module_syntax {
        Some("tsEnumIsMutable without verbatimModuleSyntax")
    } else if config.import_not_used_as_values == crate::options::ImportsNotUsedAsValues::Preserve
        && !config.verbatim_module_syntax
    {
        Some("importNotUsedAsValues: preserve without verbatimModuleSyntax")
    } else {
        None
    };
    if let Some(option) = unsupported {
        let mut diagnostic =
            swc_next_ecma_ast::Diagnostic::error("Unsupported transform option", Span::new(0, 0));
        diagnostic.message = format!("Unsupported transform option for SWC Next: {option}").into();
        crate::strip::report(cm, handler, &input, &options, vec![diagnostic])?;
    }
    Transformer::transform(
        &mut ast,
        analyzed.semantic,
        TransformerOptions {
            typescript: Some(TypeScriptOptions {
                verbatim_module_syntax: config.verbatim_module_syntax,
                ..Default::default()
            }),
            ..Default::default()
        },
    );

    let program = ast.root_program();
    program.visit_mut_with(&mut NodeModuleAssignments { ast: &mut ast });

    // SWC Next inserts a synthetic ESM marker when all module syntax is erased.
    // Honor Amaro's noEmptyExport option without removing explicit exports.
    if config.no_empty_export {
        let program = ast.root_program();
        let body = program
            .body(&ast)
            .iter()
            .map(|id| ast.get_node_in_sub_range(id))
            .filter(|statement| {
                !matches!(ast.stmt_data(*statement), StmtData::ExportNamedDeclaration(export)
                if export.span(&ast) == Span::new(0, 0)
                    && export.declaration(&ast).is_none()
                    && export.source(&ast).is_none()
                    && export.specifiers(&ast).is_empty())
            })
            .collect::<Vec<_>>();
        let body = ast.add_sub_range(body);
        program.set_body(&mut ast, body);
    }

    let output = print(
        &ast,
        PrintOptions {
            source_map_path: options
                .source_map
                .then(|| options.filename.as_deref().unwrap_or("<anon>").into()),
            ..Default::default()
        },
    );
    let map = output.map.map(|map| {
        let text = |bytes: &[u8]| String::from_utf8_lossy(bytes).into_owned();
        serde_json::json!({
            "version": map.version(),
            "sources": map.sources().iter().map(|source| text(source)).collect::<Vec<_>>(),
            "sourcesContent": [input.as_str()],
            "names": map.names().iter().map(|name| text(name)).collect::<Vec<_>>(),
            "mappings": text(map.mappings()),
        })
        .to_string()
    });
    Ok(TransformOutput {
        code: output.code,
        map,
    })
}

/// Adapt SWC Next's synchronous module loading to Node's CommonJS runtime.
struct NodeModuleAssignments<'visit, 'ast> {
    ast: &'visit mut Ast<'ast>,
}

impl<'ast> VisitMut<'ast> for NodeModuleAssignments<'_, 'ast> {
    fn ast(&mut self) -> &mut Ast<'ast> {
        self.ast
    }

    fn visit_mut_expr(&mut self, node: Expr) -> Option<Expr> {
        node.visit_mut_children_with(self);
        let ExprData::ImportExpression(import) = self.ast.expr_data(node) else {
            return None;
        };
        if !import.sync(self.ast) {
            return None;
        }
        let span = import.span(self.ast);
        let source = import.source(self.ast);
        let name = self.ast.add_utf8("require");
        let callee = self.ast.expr_identifier_reference(span, name);
        let arguments = self.ast.add_sub_range([Argument::Expr(source)]);
        Some(
            self.ast
                .expr_call_expression(span, callee, None, arguments, false),
        )
    }

    fn visit_mut_stmt(&mut self, node: Stmt) -> Option<Stmt> {
        node.visit_mut_children_with(self);
        let StmtData::TsExportAssignment(export) = self.ast.stmt_data(node) else {
            return None;
        };
        let span = export.span(self.ast);
        let right = export.expression(self.ast);
        let name = self.ast.add_utf8("module");
        let object = self.ast.expr_identifier_reference(span, name);
        let name = self.ast.add_utf8("exports");
        let key = self.ast.property_key_identifier_name(span, name);
        let left = self
            .ast
            .simple_assignment_target_member_expression(span, object, key, false, false);
        let assignment = self.ast.expr_assignment_expression(
            span,
            AssignmentTarget::SimpleAssignmentTarget(left),
            right,
            AssignmentOperator::Assign,
        );
        Some(self.ast.stmt_expression_statement(span, assignment))
    }
}
