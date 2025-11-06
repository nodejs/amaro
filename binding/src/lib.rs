#![deny(clippy::all)]

use napi_derive::napi;
use swc_ts_fast_strip::Options;

#[napi(object)]
pub struct TransformOptions {}

#[napi(object)]
pub struct TransformOutput {
  pub code: String,
  pub map: Option<String>,
}

#[napi]
pub fn transform(code: String, options: TransformOptions) -> napi::Result<TransformOutput> {
  let options = Options {};

  let result = swc_ts_fast_strip_binding::transform(code, options)
    .map_err(|e| napi::Error::from_reason(serde_json::to_string(&e[0]).unwrap()))?;

  Ok(TransformOutput {
    code: result.code,
    map: result.map,
  })
}
