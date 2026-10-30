//! Public options shared by the SWC Next adapters.
use serde::{Deserialize, Serialize};
use swc_ecma_parser::TsSyntax;
use wasm_bindgen::prelude::*;

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub module: Option<bool>,
    pub filename: Option<String>,
    #[serde(default = "default_parser")]
    pub parser: TsSyntax,
    #[serde(default)]
    pub mode: Mode,
    pub transform: Option<TransformConfig>,
    pub deprecated_ts_module_as_error: Option<bool>,
    #[serde(default)]
    pub source_map: bool,
}

fn default_parser() -> TsSyntax {
    TsSyntax {
        decorators: true,
        ..Default::default()
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Mode {
    #[default]
    StripOnly,
    Transform,
}

#[derive(Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct TransformConfig {
    pub verbatim_module_syntax: bool,
    pub native_class_properties: bool,
    pub no_empty_export: bool,
    pub import_not_used_as_values: ImportsNotUsedAsValues,
    pub import_export_assign_config: ImportExportAssignConfig,
    pub ts_enum_is_mutable: bool,
    pub jsx: Option<serde_json::Value>,
}

impl Default for TransformConfig {
    fn default() -> Self {
        Self {
            verbatim_module_syntax: false,
            native_class_properties: true,
            no_empty_export: false,
            import_not_used_as_values: ImportsNotUsedAsValues::Remove,
            import_export_assign_config: ImportExportAssignConfig::Classic,
            ts_enum_is_mutable: false,
            jsx: None,
        }
    }
}

#[derive(Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ImportsNotUsedAsValues {
    #[default]
    Remove,
    Preserve,
}

#[derive(Default, Deserialize, PartialEq, Eq)]
pub enum ImportExportAssignConfig {
    #[default]
    Classic,
    Preserve,
    NodeNext,
    EsNext,
}

#[derive(Debug, Serialize)]
pub struct TransformOutput {
    pub code: String,
    pub map: Option<String>,
}

#[wasm_bindgen(typescript_custom_section)]
const TYPES: &str = r#"
interface Options {
    module?: boolean;
    filename?: string;
    mode?: Mode;
    transform?: TransformConfig;
    deprecatedTsModuleAsError?: boolean;
    sourceMap?: boolean;
}

interface TransformConfig {
    /**
     * @see https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax
     */
    verbatimModuleSyntax?: boolean;
    /**
     * Native class properties support. Defaults to true; false is unsupported.
     */
    nativeClassProperties?: boolean;
    /** "preserve" requires verbatimModuleSyntax: true. */
    importNotUsedAsValues?: "remove" | "preserve";
    /**
     * Don't create `export {}`.
     * By default, strip creates `export {}` for modules to preserve module
     * context.
     *
     * @see https://github.com/swc-project/swc/issues/1698
     */
    noEmptyExport?: boolean;
    /** Only Classic is supported by the SWC Next adapter. */
    importExportAssignConfig?: "Classic" | "Preserve" | "NodeNext" | "EsNext";
    /**
     * Disables an optimization that inlines TS enum member values
     * within the same module that assumes the enum member values
     * are never modified.
     *
     * Defaults to false.
     */
    /** true requires verbatimModuleSyntax: true. */
    tsEnumIsMutable?: boolean;

    /**
     * JSX lowering is unsupported by the SWC Next adapter.
     */
    jsx?: JsxConfig;
}

interface JsxConfig {
    /**
     * How to transform JSX.
     *
     * @default "react-jsx"
     */
    transform?: "react-jsx" | "react-jsxdev";
}

type Mode = "strip-only" | "transform";
interface TransformOutput { code: string; map?: string; }
"#;
