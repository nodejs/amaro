#![deny(clippy::all)]

use napi_derive::napi;
use swc_ts_fast_strip::Options;

#[napi(object)]
pub struct TransformOutput {
  pub code: String,
  pub map: Option<String>,
}

#[napi]
pub fn transform(code: String, options: String) -> napi::Result<TransformOutput> {
  let options = serde_json::from_str::<Options>(&options).expect("failed to parse options");

  let result = swc_ts_fast_strip_binding::transform(code, options)
    .map_err(|e| napi::Error::from_reason(serde_json::to_string(&e[0]).unwrap()))?;

  Ok(TransformOutput {
    code: result.code,
    map: result.map,
  })
}
