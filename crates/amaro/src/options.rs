//! Public options for fixed-width TypeScript stripping.
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
    pub deprecated_ts_module_as_error: Option<bool>,
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
}

#[derive(Debug, Serialize)]
pub struct TransformOutput {
    pub code: String,
}

#[wasm_bindgen(typescript_custom_section)]
const TYPES: &str = r#"
interface Options {
    module?: boolean;
    filename?: string;
    mode?: "strip-only";
    deprecatedTsModuleAsError?: boolean;
}
interface TransformOutput { code: string; }
"#;
