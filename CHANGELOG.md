# Changelog

## [0.4.1](https://github.com/nodejs/amaro/compare/v0.4.0...v0.4.1) (2025-02-28)


### Core

* make sure the right error is emitted ([9695cf8](https://github.com/nodejs/amaro/commit/9695cf859e7990d0b096de983a739a0f03df0744))


### Miscellaneous

* build wasm from swc v1.10.18 ([ba898ad](https://github.com/nodejs/amaro/commit/ba898aded7cbede4a2d9801caa455a5e53d86deb))
* build wasm from swc v1.11.4 ([4f345be](https://github.com/nodejs/amaro/commit/4f345be3d036eb40acc3e55b252144ca52e83644))
* build wasm from swc v1.11.5 ([95d2869](https://github.com/nodejs/amaro/commit/95d2869f7e8d6cb21fc3e24989628b3648cadaa7))
* **deps:** bump actions/upload-artifact from 4.6.0 to 4.6.1 ([a37726b](https://github.com/nodejs/amaro/commit/a37726b317fe494e514bb04d358573a1161d1e51))
* **deps:** bump EmbarkStudios/cargo-deny-action from 2.0.4 to 2.0.5 ([c31db0e](https://github.com/nodejs/amaro/commit/c31db0e6f06a666afbe772db99a76973713e3ee8))
* **deps:** bump github/codeql-action from 3.28.9 to 3.28.10 ([1230254](https://github.com/nodejs/amaro/commit/1230254436bd24f980f644f12d7ce8b10cbf1ca3))
* **deps:** bump ossf/scorecard-action from 2.4.0 to 2.4.1 ([2855ed6](https://github.com/nodejs/amaro/commit/2855ed6f163bd979dd40844983bdac6403321d6e))
* update swc to v1.10.18 ([ac490b2](https://github.com/nodejs/amaro/commit/ac490b291f71aedc1edd3b3759c3ecceb1eddf7f))
* update swc to v1.11.4 ([a41ab59](https://github.com/nodejs/amaro/commit/a41ab59b175823d21d1853a091cadb25c029d2d7))
* update swc to v1.11.5 ([25e13ea](https://github.com/nodejs/amaro/commit/25e13ea5f1552d138928243c6fcef1a2d2286b57))

## [0.4.0](https://github.com/nodejs/amaro/compare/v0.3.2...v0.4.0) (2025-02-18)


### Features

* add option deprecatedTsModuleAsError ([cfc3f00](https://github.com/nodejs/amaro/commit/cfc3f001e92e0fd8b36f21a7ecdc8b41a9b7d040))


### Miscellaneous

* build wasm from swc v1.10.15 ([4e993fd](https://github.com/nodejs/amaro/commit/4e993fd61f3636c9a277a94625b8758e47661add))
* build wasm from swc v1.10.16 ([b097846](https://github.com/nodejs/amaro/commit/b09784613de6e4b8c72ef2fedda0b140ecbdad47))
* **deps:** bump docker/setup-buildx-action from 3.8.0 to 3.9.0 ([65e736c](https://github.com/nodejs/amaro/commit/65e736cbaa38cbadd09a19e3cf378a02af45653e))
* **deps:** bump github/codeql-action from 3.28.8 to 3.28.9 ([936abc0](https://github.com/nodejs/amaro/commit/936abc03bf2735c9c9b20effe7a1c7826fc6e3e3))
* **deps:** bump step-security/harden-runner from 2.10.4 to 2.11.0 ([9438700](https://github.com/nodejs/amaro/commit/94387007a0ee57781d8e101c423aa2bb7bd33f26))
* remove manual update docs ([59e35a9](https://github.com/nodejs/amaro/commit/59e35a99ed08af369e2c12c8286cf8a38a02db61))
* update swc to v1.10.15 ([78391dd](https://github.com/nodejs/amaro/commit/78391dd8f3d8289486a774ddd4f69e6b69a8a9b5))
* update swc to v1.10.16 ([fd283be](https://github.com/nodejs/amaro/commit/fd283be9b9616ac1e00c6e192ff4eb1ee96f2bc5))

## [0.3.2](https://github.com/nodejs/amaro/compare/v0.3.1...v0.3.2) (2025-02-04)


### Core

* check erasable namespaces are supported ([e489d48](https://github.com/nodejs/amaro/commit/e489d48171d4abeb80a139ef339aa5be36736e31))
* swc allows invalid js syntax ([2a3fbe8](https://github.com/nodejs/amaro/commit/2a3fbe886215c7d41bc1ffc9a3e4cf745d9e2c59))


### Miscellaneous

* build wasm from swc v1.10.12 ([081dee3](https://github.com/nodejs/amaro/commit/081dee36877b046f6f9a361412adc0fe2c34c57e))
* build wasm from swc v1.10.14 ([4e6441c](https://github.com/nodejs/amaro/commit/4e6441c843a52e70bef56458799e267151b9cbc4))
* **deps:** bump actions/setup-node from 4.1.0 to 4.2.0 ([43ee356](https://github.com/nodejs/amaro/commit/43ee356f3e46fb1f980622c2fd8acd40356d87ac))
* **deps:** bump github/codeql-action from 3.28.5 to 3.28.8 ([85ca75b](https://github.com/nodejs/amaro/commit/85ca75bbcb60b36d60f883294d30d30a24a4a76f))
* update swc to v1.10.12 ([e2559e7](https://github.com/nodejs/amaro/commit/e2559e772f9d75cac26b52b8218e0cea2da48512))
* update swc to v1.10.14 ([fa2d3ac](https://github.com/nodejs/amaro/commit/fa2d3ac4daba345f115ab67382791eea055d5bc7))

## [0.3.1](https://github.com/nodejs/amaro/compare/v0.3.0...v0.3.1) (2025-01-27)


### Bug Fixes

* check undefined format ([722b484](https://github.com/nodejs/amaro/commit/722b4842ea2414b7f304128bbff9ea9db1cc7c28))


### Core

* check if newline on return works ([fe0f570](https://github.com/nodejs/amaro/commit/fe0f5704e9965ae50bb49f0ee7e1e4d6a4ee1d6b))
* check if yield and throw newline work ([96dba79](https://github.com/nodejs/amaro/commit/96dba7943a83deab3c705227e49fb99aa10d1580))


### Miscellaneous

* build wasm from swc v1.10.11 ([cdea312](https://github.com/nodejs/amaro/commit/cdea31243b1c32380f0dd442575038195f189486))
* **deps:** bump github/codeql-action from 3.28.1 to 3.28.5 ([ce514fa](https://github.com/nodejs/amaro/commit/ce514fad88b184a0717eec105b29dd99335e7ca2))
* **deps:** bump step-security/harden-runner from 2.10.3 to 2.10.4 ([9059a36](https://github.com/nodejs/amaro/commit/9059a366d277c2398dca62a91bd5814e9df41fff))
* **deps:** bump wagoid/commitlint-github-action from 6.2.0 to 6.2.1 ([1a876ff](https://github.com/nodejs/amaro/commit/1a876ffe67816b1f6f60c5631d74861ddaae2fe2))
* update swc to v1.10.11 ([e9a918c](https://github.com/nodejs/amaro/commit/e9a918ce7ea9969c1d930f69372c7d51e69fb6af))

## [0.3.0](https://github.com/nodejs/amaro/compare/v0.2.2...v0.3.0) (2025-01-13)


### Features

* wrap and rethrow swc errors ([8764122](https://github.com/nodejs/amaro/commit/87641224c949422f1d1b2734309bc1d907df69de))


### Miscellaneous

* build wasm from swc v1.10.7 ([35efcea](https://github.com/nodejs/amaro/commit/35efceaf8349d0b9c325f059591111c1bf0f2459))
* **deps:** bump actions/upload-artifact from 4.5.0 to 4.6.0 ([1d8a938](https://github.com/nodejs/amaro/commit/1d8a938ce7d32651c0eca220d62abf045b4202bb))
* **deps:** bump biomejs/setup-biome from 2.2.1 to 2.3.0 ([10c101c](https://github.com/nodejs/amaro/commit/10c101c03d9203822996c2e4cb22a3d9849cf7ff))
* **deps:** bump github/codeql-action from 3.28.0 to 3.28.1 ([4b29609](https://github.com/nodejs/amaro/commit/4b296094d713a88c241c6d80df713f505676350a))
* **deps:** bump step-security/harden-runner from 2.10.2 to 2.10.3 ([e355436](https://github.com/nodejs/amaro/commit/e355436679007ef78f6ca83942ec098269b86b09))
* exclude fixtures from typecheck ([2a3c016](https://github.com/nodejs/amaro/commit/2a3c016134fc34aad694e92c5cd1a90fc6107fb7))
* update swc to v1.10.7 ([8051db3](https://github.com/nodejs/amaro/commit/8051db3a2b6e7fa3335da9904ccf85d293c77826))

## [0.2.2](https://github.com/nodejs/amaro/compare/v0.2.1...v0.2.2) (2025-01-06)


### Miscellaneous

* build wasm from swc v1.10.4 ([a00240a](https://github.com/nodejs/amaro/commit/a00240acbebce535144b26b6ebb6bc65c7e04d8e))
* **deps:** bump github/codeql-action from 3.27.0 to 3.28.0 ([88051e0](https://github.com/nodejs/amaro/commit/88051e07265c4f33dd6b0e55e73df176492b1236))
* include chore in change logs ([9ab6341](https://github.com/nodejs/amaro/commit/9ab6341c697116fa4f5af656a1390c4f228531b9))
* update release actions ([9538187](https://github.com/nodejs/amaro/commit/95381873d9dd2fbe720ab01138b7653e3afc12d4))
* update swc to v1.10.4 ([af1fd9c](https://github.com/nodejs/amaro/commit/af1fd9c3aa795bc9e0adb3907662e8b254899b57))
