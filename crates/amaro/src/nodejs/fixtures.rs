//! Shared JSON fixtures under `test/fixtures/nodejs`, also exercised from
//! JavaScript by `test/nodejs.test.js` against the WebAssembly build.

use std::{fs, path::PathBuf};

use serde::Deserialize;
use serde_json::Value;

use super::{
    find_top_level_awaits, is_recoverable_error, parse_program_result, tokenize, ParseOutcome,
    SyntaxError,
};

#[derive(Deserialize)]
struct Case {
    source: String,
    expected: Value,
}

fn fixture_files(suite: &str) -> Vec<PathBuf> {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures/nodejs")
        .join(suite);
    let mut files = fs::read_dir(&dir)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", dir.display()))
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .collect::<Vec<_>>();
    files.sort();
    assert!(!files.is_empty(), "no fixtures in {}", dir.display());
    files
}

fn check_cases(suite: &str, run: impl Fn(String) -> Value) {
    for path in fixture_files(suite) {
        let cases: Vec<Case> = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        for case in cases {
            assert_eq!(
                run(case.source.clone()),
                case.expected,
                "{}: source: {:?}",
                path.display(),
                case.source
            );
        }
    }
}

#[test]
fn tokens() {
    check_cases("tokenize", |source| {
        serde_json::to_value(tokenize(&source)).unwrap()
    });
}

#[test]
fn awaits() {
    check_cases("awaits", |source| {
        serde_json::to_value(find_top_level_awaits(&source)).unwrap()
    });
}

#[test]
fn recoverable() {
    check_cases("recoverable", |source| {
        Value::Bool(is_recoverable_error(source))
    });
}

#[test]
fn unexpected_eof_variant() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures/nodejs/recoverable/unexpected-eof.json");
    let cases: Vec<Case> = serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
    for case in cases {
        let ParseOutcome::Invalid(errors) = parse_program_result(&case.source) else {
            panic!("expected a parse error: {:?}", case.source);
        };
        assert!(
            errors.iter().any(|error| matches!(
                error.kind(),
                SyntaxError::Unexpected { got, .. } if got == "<eof>"
            )),
            "errors: {errors:?}"
        );
    }
}
