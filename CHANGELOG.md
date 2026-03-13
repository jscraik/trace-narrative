# Changelog

## [0.18.1](https://github.com/jscraik/trace-narrative/compare/firefly-narrative-v0.18.0...firefly-narrative-v0.18.1) (2026-03-11)


### Bug Fixes

* **ci:** skip bot-only gates for dependabot PRs ([#79](https://github.com/jscraik/trace-narrative/issues/79)) ([fa6b1c1](https://github.com/jscraik/trace-narrative/commit/fa6b1c1d0ce915eca313b1effc6b485edb348c5a))

## [0.18.0](https://github.com/jscraik/trace-narrative/compare/firefly-narrative-v0.17.1...firefly-narrative-v0.18.0) (2026-03-08)


### Features

* **trust:** Phase 4 trust-state UX integration with P1/P2 fixes ([#72](https://github.com/jscraik/trace-narrative/issues/72)) ([89e6e1a](https://github.com/jscraik/trace-narrative/commit/89e6e1acf92d8fcab9e372f6d25f0b9570975345))


### Bug Fixes

* **docs:** unblock lint baseline and audit gate ([#70](https://github.com/jscraik/trace-narrative/issues/70)) ([2071ccc](https://github.com/jscraik/trace-narrative/commit/2071ccc5a82877aa0d5424821cc6ab4a0d9d20b9))
* **ui:** wire trust-state props to BranchNarrativePanel ([89e6e1a](https://github.com/jscraik/trace-narrative/commit/89e6e1acf92d8fcab9e372f6d25f0b9570975345))

## [0.17.1](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.17.0...firefly-narrative-v0.17.1) (2026-03-02)


### Bug Fixes

* **ci:** add npm auth for private [@brainwav](https://github.com/brainwav) packages in release workflow ([#62](https://github.com/jscraik/firefly-narrative/issues/62)) ([aaafc9c](https://github.com/jscraik/firefly-narrative/commit/aaafc9cf350e889aaf66067bb0f6cb102adb55ec))

## [0.17.0](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.16.0...firefly-narrative-v0.17.0) (2026-03-02)


### Features

* add analytics dashboard with drill-down navigation ([cba4184](https://github.com/jscraik/firefly-narrative/commit/cba41844be69b373363faad42dfa3dce47480ef9))
* add ask-why answer card UI (Phase 2) ([#51](https://github.com/jscraik/firefly-narrative/issues/51)) ([a13e019](https://github.com/jscraik/firefly-narrative/commit/a13e0192b062e6832a31df391077e837d11c7131))
* add attribution notes metadata and CI icons ([91b1938](https://github.com/jscraik/firefly-narrative/commit/91b1938b11b3ec7accc70b85519c67a297b7aacb))
* Add Docs panel with Mermaid diagram support ([39f35e4](https://github.com/jscraik/firefly-narrative/commit/39f35e481ba14bdab24b61c5524f5604fcc70e15))
* add getTraceBadgeLabel helper for trace badges ([f3a7589](https://github.com/jscraik/firefly-narrative/commit/f3a7589fa93593ea45d433b17ec50b84e9494c88))
* add governance baseline sweep artifacts ([#23](https://github.com/jscraik/firefly-narrative/issues/23)) ([6b442b7](https://github.com/jscraik/firefly-narrative/commit/6b442b71f92ee3228c3a62e89c42a855e1332d94))
* add story anchors ([50df540](https://github.com/jscraik/firefly-narrative/commit/50df540bd47d67b554f51f4badfe05ffb1d71fb4))
* **agentation:** add critique mode and mode-aware autopilot status ([#17](https://github.com/jscraik/firefly-narrative/issues/17)) ([2b18289](https://github.com/jscraik/firefly-narrative/commit/2b1828954f0e617f7d53cf90e92db3ee2c597b67))
* **atlas:** add repo-scoped session search ([d5e6e41](https://github.com/jscraik/firefly-narrative/commit/d5e6e413378681093b5b5325760a662920427f7b))
* **capture:** activity feed, steps summary, and refreshed icon ([dc0bad8](https://github.com/jscraik/firefly-narrative/commit/dc0bad8b70807ddfb6f6ca4227f8dcdbd835c4c5))
* **capture:** auto-detect sources, codex fallback, and keychain OTLP key ([07797f9](https://github.com/jscraik/firefly-narrative/commit/07797f990d4d62af13c32dc61170c19cd7a5276d))
* causal recall copilot phase 1 foundation ([#50](https://github.com/jscraik/firefly-narrative/issues/50)) ([71370c1](https://github.com/jscraik/firefly-narrative/commit/71370c1ad0e2e99388ffb865295df6e4173e99ed))
* **codex-app-server:** add cp4 rollout gates and schema drift checks ([cbc1c9d](https://github.com/jscraik/firefly-narrative/commit/cbc1c9d2926288d517810de299836da3dffcf2b8))
* **codex-app-server:** add in-app live auth test controls ([3832666](https://github.com/jscraik/firefly-narrative/commit/383266612b16130ef985f666e4114a8c5492583b))
* **codex-app-server:** add release gates and UI parity updates ([96aca13](https://github.com/jscraik/firefly-narrative/commit/96aca13a6f2a5503ea819fff293ae5e3805299d2))
* **codex-app-server:** add sidecar supervisor and live event bridge ([eb14bd4](https://github.com/jscraik/firefly-narrative/commit/eb14bd40cc43c4513ba2d481bf4a1e3f31966ad0))
* **codex-app-server:** enforce protocol auth/approval parity ([8a2629f](https://github.com/jscraik/firefly-narrative/commit/8a2629fef623302c19e1c7fa5e1c2a891d1a3a3e))
* **codex-app-server:** enforce sidecar manifest trust gates ([34a1213](https://github.com/jscraik/firefly-narrative/commit/34a12132360841a59a56865f02bd6ed2f0897c14))
* **codex-app-server:** harden reconnect validation and completion persistence ([1a9314f](https://github.com/jscraik/firefly-narrative/commit/1a9314f5af401b9a721e78b97c0ad8fd4e6b8a9f))
* **codex-app-server:** send initialize handshake over stdio ([665fdcd](https://github.com/jscraik/firefly-narrative/commit/665fdcdd397e955d05954164099d704ddbaeafbb))
* complete session-to-commit linking MVP v1 ([64e8f5d](https://github.com/jscraik/firefly-narrative/commit/64e8f5d3ae97f3cb79d7e760304ae028f38499a7))
* Complete Tauri auto-updater implementation ([4055243](https://github.com/jscraik/firefly-narrative/commit/4055243a430243ad8f140a4eae85ff7a3d0445e2))
* docs linting + agent trace updates ([a3fccd2](https://github.com/jscraik/firefly-narrative/commit/a3fccd2cc9571937c8b2c5983e577852c6e17927))
* enable auto-updates, add Docs view with auto-repo-load, add release script ([b197dc1](https://github.com/jscraik/firefly-narrative/commit/b197dc1dea90b5fa1b6cb1f8cc819f36c66a518d))
* **firefly:** implement Firefly Signal System Phase 1 ([08391cf](https://github.com/jscraik/firefly-narrative/commit/08391cfba240aa639694342bbd7629caa3736a06))
* **firefly:** implement semantic state orchestration ([e5d0e9b](https://github.com/jscraik/firefly-narrative/commit/e5d0e9bd344f0197e6130c95037b4fd5b4df36b4))
* gold standard quality gates + git notes integration ([98ebf3a](https://github.com/jscraik/firefly-narrative/commit/98ebf3a5df0564a5b4d53d5af59c4948d6999f6a))
* hybrid codex+claude capture reliability v1 scaffolding ([#25](https://github.com/jscraik/firefly-narrative/issues/25)) ([fb77f52](https://github.com/jscraik/firefly-narrative/commit/fb77f524abfbf92aa8e446cb704f969a2169e28c))
* implement narrative version control v1.0 UI/UX improvements ([25de5ee](https://github.com/jscraik/firefly-narrative/commit/25de5ee0623e4c40d8b243d9352b669783213102))
* import JUnit test runs + mentioned-files UX ([8995b69](https://github.com/jscraik/firefly-narrative/commit/8995b6950842e04cc58829fe7b520e14e269ce08))
* improve theming, session links, and agentation autopilot ([bcfdafb](https://github.com/jscraik/firefly-narrative/commit/bcfdafb205afd1864c83b45e604781a4e1bce866))
* **ingest:** align canonical collector root to ~/.agents/otel-collector ([99dc550](https://github.com/jscraik/firefly-narrative/commit/99dc550796d2321c1c8cfb0ff5e154baa12c3a04))
* keep dialkit dev-only for landing ([4618a14](https://github.com/jscraik/firefly-narrative/commit/4618a1410a370837a9b715c5e4fd03b7dfc6de40))
* Narrative Truth Loop feedback calibration ([#37](https://github.com/jscraik/firefly-narrative/issues/37)) ([59be4bf](https://github.com/jscraik/firefly-narrative/commit/59be4bf3fee4d3040b1a4134af60336438744432))
* narrative truth-loop feedback calibration and coding-harness governance ([#41](https://github.com/jscraik/firefly-narrative/issues/41)) ([4caa235](https://github.com/jscraik/firefly-narrative/commit/4caa23531e49b1210e0c4299337e708b78241040))
* **narrative:** add phase-1 branch narrative composer and disclosure panel ([b5bfaa0](https://github.com/jscraik/firefly-narrative/commit/b5bfaa08f3a748e9a1f48afd1badb115fd9ba2b2))
* **narrative:** add phase-3 rollout governance and kill-switch ([e99d624](https://github.com/jscraik/firefly-narrative/commit/e99d6247e5058acf858560ea3ff7927935bf17d7))
* **narrative:** add truth-loop feedback calibration ([abf0015](https://github.com/jscraik/firefly-narrative/commit/abf001521f7237923f8f5a934f1714237844279d))
* **narrative:** implement phase-2 projections archaeology and github context ([af5cd47](https://github.com/jscraik/firefly-narrative/commit/af5cd47284fa232576e27af10a741f5719b76472))
* **Phase A:** documentation + performance tooling ([5040acf](https://github.com/jscraik/firefly-narrative/commit/5040acf228e041c0e72bbee0a1d8c57679f93f86))
* **Phase B:** testing deep dive ([1ab22e9](https://github.com/jscraik/firefly-narrative/commit/1ab22e9e44d7ca886527624b873baded6b6904d9))
* **Phase C:** accessibility improvements ([08458fa](https://github.com/jscraik/firefly-narrative/commit/08458fa76a096627e338c7a485924a119e54bb40))
* **Phase D:** architecture cleanup - modularize agent trace ([30be006](https://github.com/jscraik/firefly-narrative/commit/30be006620ca998a05645cd171c15bd54ef0ea03))
* polish UI states and harden session auto-ingest/linking ([f938510](https://github.com/jscraik/firefly-narrative/commit/f938510c3b7e428f54fc15f1da573c395a6f8cc4))
* **redaction:** expand secret detection patterns and add tests ([b62e209](https://github.com/jscraik/firefly-narrative/commit/b62e209b4c962841c7b0ff8c9f2af0826e24f038))
* Rename app to Firefly Narrative and enhance Firefly Signal UI ([b487d59](https://github.com/jscraik/firefly-narrative/commit/b487d59516245e465e811883178cf02749707cbe))
* **session-badges:** enhance with tool icons, colors, and labels ([fa5093f](https://github.com/jscraik/firefly-narrative/commit/fa5093f6c7cea41e05a581ee43fcc0d94889f560))
* **sidecar:** pin bundled artifacts for release parity ([f5d7df4](https://github.com/jscraik/firefly-narrative/commit/f5d7df44ece679751e5cf46ca9c02e060bf017a8))
* **ui:** commit pending branch updates ([6a3706e](https://github.com/jscraik/firefly-narrative/commit/6a3706e0a84dcf1cddd75c95fc70380434d7610c))
* **ui:** hide otel file-path controls when embedded receiver is active ([a909573](https://github.com/jscraik/firefly-narrative/commit/a909573617eaa2bdbbfaf34fd1f64ff07440e415))
* **ui:** sync themes, improve layout, add mock loader ([7010cf9](https://github.com/jscraik/firefly-narrative/commit/7010cf9f173f6805fd097181f6531ebe12a14fc5))


### Bug Fixes

* Add icon field to tauri.conf.json bundle configuration ([29a8bbd](https://github.com/jscraik/firefly-narrative/commit/29a8bbd227179e323c7ebd226ec18f7cdda2763e))
* align markdownlint scope and ordering ([d23502a](https://github.com/jscraik/firefly-narrative/commit/d23502abff353beeea3363b0ffff7bcd3a807722))
* **build:** default tauri build to app bundle ([fb2fa75](https://github.com/jscraik/firefly-narrative/commit/fb2fa75f18d4186ef263744566e0c92179f40fbd))
* **cargo:** add default-run key to enable dev server ([3aeee16](https://github.com/jscraik/firefly-narrative/commit/3aeee16f8a114c5c7fad52adbdd50aa6ff6c1fc3))
* **ci:** gracefully skip diagram CLI when not installed ([#60](https://github.com/jscraik/firefly-narrative/issues/60)) ([6101e47](https://github.com/jscraik/firefly-narrative/commit/6101e470aa42182e21a950e2a664f589610a94ff))
* **ci:** handle empty grep in harness-cli.sh file count ([#57](https://github.com/jscraik/firefly-narrative/issues/57)) ([d996884](https://github.com/jscraik/firefly-narrative/commit/d9968843392843c6bfb90d19fe7a063782e2dd6c))
* **ci:** handle grep returning 1 in harness-gates workflow ([#58](https://github.com/jscraik/firefly-narrative/issues/58)) ([ad061d8](https://github.com/jscraik/firefly-narrative/commit/ad061d8f214cdd2744c36869036fe4766687dde6))
* **ci:** repair Release workflow rust toolchain and tag input ([3894251](https://github.com/jscraik/firefly-narrative/commit/3894251b30e5542d739c9e9a117ad1307bc28eb6))
* **ci:** stabilize e2e selectors and lighthouse preview port ([52763aa](https://github.com/jscraik/firefly-narrative/commit/52763aa790e54ecac1f9a0168acb84f4f1bc1007))
* **ci:** trigger release workflow for release-please tags ([af7e414](https://github.com/jscraik/firefly-narrative/commit/af7e414e0cdf99f992142956f5642855449a380c))
* **codex-app-server:** drive auth and events from real sidecar messages ([511323d](https://github.com/jscraik/firefly-narrative/commit/511323dbc76dfa67a45e7de266f9261274c02b35))
* **codex-app-server:** keep sidecar stdin open to prevent crash loop ([9aa7075](https://github.com/jscraik/firefly-narrative/commit/9aa7075340188ffba1dbdf0df693f2daf9cd4394))
* **codex-app-server:** launch real codex app-server from sidecar wrapper ([e19e6f8](https://github.com/jscraik/firefly-narrative/commit/e19e6f8caeef3c02861b22084357118a7f4191af))
* **codex-app-server:** prevent startup crash loop in desktop sidecar ([f9ef1a4](https://github.com/jscraik/firefly-narrative/commit/f9ef1a4ae2fd787bcb897b8fe2b47010e01771be))
* complete review findings and firefly cleanup ([47a0fba](https://github.com/jscraik/firefly-narrative/commit/47a0fbaa6ac3f970472bee71506cd6abe74e7d65))
* Disable auto-update check on launch (GitHub releases not ready yet) ([afca4f8](https://github.com/jscraik/firefly-narrative/commit/afca4f81e3c63b6cc4c40a484be2afff2356b6ce))
* Explicitly configure bundle targets to include DMG for macOS ([32c618b](https://github.com/jscraik/firefly-narrative/commit/32c618bd8793fb022c97e6bcdda64c3d44ef585f))
* **firefly:** skip settings persistence in dev mode ([f51b57a](https://github.com/jscraik/firefly-narrative/commit/f51b57abfb60ddcce57b8b48e82f6b38fb45d66f))
* improve error messages in secure_parser with expect() calls ([c11cdfa](https://github.com/jscraik/firefly-narrative/commit/c11cdfa2f1963968fce0414ce8b9bb7323bf4f4b))
* Improve release workflow with better caching and build steps ([ccc347a](https://github.com/jscraik/firefly-narrative/commit/ccc347a2bad44854701dc92e932a1446e8409389))
* **ingest:** codex lookup budget + hook shell escaping ([834dab9](https://github.com/jscraik/firefly-narrative/commit/834dab95d417b99e65bd4a137cd5ac1b29eedc2d))
* **ingest:** windows-safe codex watch + hooks cli lookup ([065c4f3](https://github.com/jscraik/firefly-narrative/commit/065c4f34d4326cb0da5f5852ed195197bfbe0371))
* **JSC-10:** refactor monolithic SourceLensView component ([9fea1c7](https://github.com/jscraik/firefly-narrative/commit/9fea1c74e2b88b41b9530b6ec1c54054983ad85f))
* JSC-11 add API key auth and rate limiting to OTLP receiver ([9c71fc5](https://github.com/jscraik/firefly-narrative/commit/9c71fc591b213c01ea78d31b4c0e0d0ecf46a555))
* **JSC-12:** refactor monolithic Timeline component ([e01573d](https://github.com/jscraik/firefly-narrative/commit/e01573d468aa819c947eadd068b651cda5dce12e))
* JSC-13 race condition in OTLP receiver startup ([24ad10b](https://github.com/jscraik/firefly-narrative/commit/24ad10b77c4688c00b04227fc3449f14b02ed049))
* JSC-14 silent failures in otlp_receiver error handling ([783449a](https://github.com/jscraik/firefly-narrative/commit/783449a5712cd5105204e68fa04c416fd75172c2))
* JSC-9 memory leak in diff cache with LRU cache ([5069e87](https://github.com/jscraik/firefly-narrative/commit/5069e87c3537d9f979a31fbce3631e21e624d550))
* **lint:** remove unnecessary dependency from useEffect ([ec6b9f6](https://github.com/jscraik/firefly-narrative/commit/ec6b9f60cd0a60fa00beb5e425e99b96ead45cc2))
* **narrative:** harden rollout guards and connector error handling ([4109436](https://github.com/jscraik/firefly-narrative/commit/4109436853c2e6856a43b404867f92444da2abed))
* narrow docs lint scope for CI consistency ([73747f9](https://github.com/jscraik/firefly-narrative/commit/73747f9b13d674a69167f2a2c234b82ec4f22d07))
* post-merge type errors and regex compatibility ([32f5a5d](https://github.com/jscraik/firefly-narrative/commit/32f5a5dcb3af0fafc67fc41ac57d5c0b2c5d604b))
* prevent scroll reset when session badges unchanged ([fe5a812](https://github.com/jscraik/firefly-narrative/commit/fe5a812b0c00d760f5a5fb960dffdf6b833b7c82))
* **release:** add no-sign fallback for unsigned builds ([c64d42d](https://github.com/jscraik/firefly-narrative/commit/c64d42da6c65fe9a15e10298372efbb9493553c8))
* **release:** handle case where version is already updated ([47fb50f](https://github.com/jscraik/firefly-narrative/commit/47fb50fb61a6823320f00d09f32465eee43794f9))
* remove committed artifacts and use app data dir for db ([9d61624](https://github.com/jscraik/firefly-narrative/commit/9d61624aed4476a585815e53230936f7366f44c4))
* remove stale FireflyEvent import ([9ea1440](https://github.com/jscraik/firefly-narrative/commit/9ea1440dbd931a0a171c48acffd519f4ffca495f))
* replace runtime panics and add error logging ([3f4a3f3](https://github.com/jscraik/firefly-narrative/commit/3f4a3f3c9a0c5c9c15c419f8ff86d4fc3d7480f1))
* resolve blank window on app startup and fix linting issues ([97db77a](https://github.com/jscraik/firefly-narrative/commit/97db77a9558518e73a3491c348add158dec95923))
* resolve docs and lint CI failures ([22482bf](https://github.com/jscraik/firefly-narrative/commit/22482bfb7b6a3160a75eeb6056093663b6497e0d))
* resolve Tauri parameter naming mismatch ([31e9dbe](https://github.com/jscraik/firefly-narrative/commit/31e9dbef07f4401cf491f492798e0240480a5432))
* **sessions:** add error logging to silent catch blocks ([0428773](https://github.com/jscraik/firefly-narrative/commit/0428773499e525d46c210d2f90620a92fdc38a31))
* skip OAuth login when Codex sidecar already authenticated ([0911902](https://github.com/jscraik/firefly-narrative/commit/09119021ba5ca2f135c88c36e93b776dedc21d82))
* stabilize docs and lint CI checks ([3883718](https://github.com/jscraik/firefly-narrative/commit/388371886e56cd3ce4d3c40215a7f4d23c5b6f04))
* **story-anchors:** bundle narrative-cli resource ([cd21a1d](https://github.com/jscraik/firefly-narrative/commit/cd21a1dcacc558b1ef33ade4550719bb5bd9ca24))
* strip trailing slash from normalized URLs ([1b80758](https://github.com/jscraik/firefly-narrative/commit/1b80758ffeac9578814980dffce8749666d738e0))
* **tauri:** allow firefly settings store plugin in ACL ([5be41b8](https://github.com/jscraik/firefly-narrative/commit/5be41b8198f00ca8096d2221c5d26b13a730d732))
* tighten otlp auth and repo loading ([aaea3c8](https://github.com/jscraik/firefly-narrative/commit/aaea3c837463def8b42daaa21515658a97111303))
* **tooling:** token lint allowlist windows path ([d6c521a](https://github.com/jscraik/firefly-narrative/commit/d6c521a127824596539c671e2bfd25bbf964b241))
* **ui:** address 14 low severity spacing, color, animation, motion issues ([b69e68e](https://github.com/jscraik/firefly-narrative/commit/b69e68e6dc1029a15a7f445f8fab8b6049944259))
* **ui:** address 17 medium severity spacing, color, animation, motion issues ([1d3afc5](https://github.com/jscraik/firefly-narrative/commit/1d3afc55068dc025c18dd00cccb8ad3cf60ab490))
* **ui:** address critical and high severity spacing, color, animation, motion issues ([8de4719](https://github.com/jscraik/firefly-narrative/commit/8de471990f82611bdf3b5938172211a9d9c395ab))
* **ui:** dialog close semantics + menu pointer ([98a936d](https://github.com/jscraik/firefly-narrative/commit/98a936dd54e59825910bf9b0909f92e884d41fcc))
* **ui:** dropdown menu a11y + close confirm dialog ([6b71799](https://github.com/jscraik/firefly-narrative/commit/6b71799f612cd6cf0b32c75f9c3a4d14ced2322f))
* **ui:** restore design system tokens in TopNav ([71a994b](https://github.com/jscraik/firefly-narrative/commit/71a994b61cdcda67a9d75ac86d267e229c0d3ef8))
* **ui:** tokens + ingest + docs baseline ([b40293d](https://github.com/jscraik/firefly-narrative/commit/b40293d2ea7a9bbdc814b00116fe4be45aa43735))
* Use correct Tauri command names for Docs panel ([f6d4909](https://github.com/jscraik/firefly-narrative/commit/f6d49095641f03f31c20246d96668aab723cc69b))
* Wire up Docs panel to sync with opened repo ([3d31131](https://github.com/jscraik/firefly-narrative/commit/3d311314b4d340dec0eebf95c6048a7f6b2e7674))

## [0.16.0](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.15.0...firefly-narrative-v0.16.0) (2026-03-02)


### Features

* add ask-why answer card UI (Phase 2) ([#51](https://github.com/jscraik/firefly-narrative/issues/51)) ([a13e019](https://github.com/jscraik/firefly-narrative/commit/a13e0192b062e6832a31df391077e837d11c7131))
* causal recall copilot phase 1 foundation ([#50](https://github.com/jscraik/firefly-narrative/issues/50)) ([71370c1](https://github.com/jscraik/firefly-narrative/commit/71370c1ad0e2e99388ffb865295df6e4173e99ed))


### Bug Fixes

* prevent scroll reset when session badges unchanged ([fe5a812](https://github.com/jscraik/firefly-narrative/commit/fe5a812b0c00d760f5a5fb960dffdf6b833b7c82))
* skip OAuth login when Codex sidecar already authenticated ([0911902](https://github.com/jscraik/firefly-narrative/commit/09119021ba5ca2f135c88c36e93b776dedc21d82))
* strip trailing slash from normalized URLs ([1b80758](https://github.com/jscraik/firefly-narrative/commit/1b80758ffeac9578814980dffce8749666d738e0))

## [0.15.0](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.14.0...firefly-narrative-v0.15.0) (2026-02-28)


### Features

* narrative truth-loop feedback calibration and coding-harness governance ([#41](https://github.com/jscraik/firefly-narrative/issues/41)) ([4caa235](https://github.com/jscraik/firefly-narrative/commit/4caa23531e49b1210e0c4299337e708b78241040))

## [0.14.0](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.13.0...firefly-narrative-v0.14.0) (2026-02-26)


### Features

* **codex-app-server:** add cp4 rollout gates and schema drift checks ([cbc1c9d](https://github.com/jscraik/firefly-narrative/commit/cbc1c9d2926288d517810de299836da3dffcf2b8))
* **codex-app-server:** add in-app live auth test controls ([3832666](https://github.com/jscraik/firefly-narrative/commit/383266612b16130ef985f666e4114a8c5492583b))
* **codex-app-server:** add release gates and UI parity updates ([96aca13](https://github.com/jscraik/firefly-narrative/commit/96aca13a6f2a5503ea819fff293ae5e3805299d2))
* **codex-app-server:** add sidecar supervisor and live event bridge ([eb14bd4](https://github.com/jscraik/firefly-narrative/commit/eb14bd40cc43c4513ba2d481bf4a1e3f31966ad0))
* **codex-app-server:** enforce protocol auth/approval parity ([8a2629f](https://github.com/jscraik/firefly-narrative/commit/8a2629fef623302c19e1c7fa5e1c2a891d1a3a3e))
* **codex-app-server:** enforce sidecar manifest trust gates ([34a1213](https://github.com/jscraik/firefly-narrative/commit/34a12132360841a59a56865f02bd6ed2f0897c14))
* **codex-app-server:** harden reconnect validation and completion persistence ([1a9314f](https://github.com/jscraik/firefly-narrative/commit/1a9314f5af401b9a721e78b97c0ad8fd4e6b8a9f))
* **codex-app-server:** send initialize handshake over stdio ([665fdcd](https://github.com/jscraik/firefly-narrative/commit/665fdcdd397e955d05954164099d704ddbaeafbb))
* **ingest:** align canonical collector root to ~/.agents/otel-collector ([99dc550](https://github.com/jscraik/firefly-narrative/commit/99dc550796d2321c1c8cfb0ff5e154baa12c3a04))
* keep dialkit dev-only for landing ([4618a14](https://github.com/jscraik/firefly-narrative/commit/4618a1410a370837a9b715c5e4fd03b7dfc6de40))
* **narrative:** add truth-loop feedback calibration ([abf0015](https://github.com/jscraik/firefly-narrative/commit/abf001521f7237923f8f5a934f1714237844279d))
* **sidecar:** pin bundled artifacts for release parity ([f5d7df4](https://github.com/jscraik/firefly-narrative/commit/f5d7df44ece679751e5cf46ca9c02e060bf017a8))
* **ui:** commit pending branch updates ([6a3706e](https://github.com/jscraik/firefly-narrative/commit/6a3706e0a84dcf1cddd75c95fc70380434d7610c))
* **ui:** hide otel file-path controls when embedded receiver is active ([a909573](https://github.com/jscraik/firefly-narrative/commit/a909573617eaa2bdbbfaf34fd1f64ff07440e415))


### Bug Fixes

* **build:** default tauri build to app bundle ([fb2fa75](https://github.com/jscraik/firefly-narrative/commit/fb2fa75f18d4186ef263744566e0c92179f40fbd))
* **codex-app-server:** drive auth and events from real sidecar messages ([511323d](https://github.com/jscraik/firefly-narrative/commit/511323dbc76dfa67a45e7de266f9261274c02b35))
* **codex-app-server:** keep sidecar stdin open to prevent crash loop ([9aa7075](https://github.com/jscraik/firefly-narrative/commit/9aa7075340188ffba1dbdf0df693f2daf9cd4394))
* **codex-app-server:** launch real codex app-server from sidecar wrapper ([e19e6f8](https://github.com/jscraik/firefly-narrative/commit/e19e6f8caeef3c02861b22084357118a7f4191af))
* **codex-app-server:** prevent startup crash loop in desktop sidecar ([f9ef1a4](https://github.com/jscraik/firefly-narrative/commit/f9ef1a4ae2fd787bcb897b8fe2b47010e01771be))
* **release:** add no-sign fallback for unsigned builds ([c64d42d](https://github.com/jscraik/firefly-narrative/commit/c64d42da6c65fe9a15e10298372efbb9493553c8))
* **tauri:** allow firefly settings store plugin in ACL ([5be41b8](https://github.com/jscraik/firefly-narrative/commit/5be41b8198f00ca8096d2221c5d26b13a730d732))

## [0.13.0](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.12.1...firefly-narrative-v0.13.0) (2026-02-24)


### Features

* Narrative Truth Loop feedback calibration ([#37](https://github.com/jscraik/firefly-narrative/issues/37)) ([59be4bf](https://github.com/jscraik/firefly-narrative/commit/59be4bf3fee4d3040b1a4134af60336438744432))

## [0.12.1](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.12.0...firefly-narrative-v0.12.1) (2026-02-24)


### Bug Fixes

* complete review findings and firefly cleanup ([47a0fba](https://github.com/jscraik/firefly-narrative/commit/47a0fbaa6ac3f970472bee71506cd6abe74e7d65))

## [0.12.0](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.11.0...firefly-narrative-v0.12.0) (2026-02-20)


### Features

* hybrid codex+claude capture reliability v1 scaffolding ([#25](https://github.com/jscraik/firefly-narrative/issues/25)) ([fb77f52](https://github.com/jscraik/firefly-narrative/commit/fb77f524abfbf92aa8e446cb704f969a2169e28c))

## [0.11.0](https://github.com/jscraik/firefly-narrative/compare/firefly-narrative-v0.10.0...firefly-narrative-v0.11.0) (2026-02-19)


### Features

* add governance baseline sweep artifacts ([#23](https://github.com/jscraik/firefly-narrative/issues/23)) ([6b442b7](https://github.com/jscraik/firefly-narrative/commit/6b442b71f92ee3228c3a62e89c42a855e1332d94))

## [0.10.0](https://github.com/jscraik/narrative/compare/firefly-narrative-v0.9.0...firefly-narrative-v0.10.0) (2026-02-18)


### Features

* add analytics dashboard with drill-down navigation ([cba4184](https://github.com/jscraik/narrative/commit/cba41844be69b373363faad42dfa3dce47480ef9))
* add attribution notes metadata and CI icons ([91b1938](https://github.com/jscraik/narrative/commit/91b1938b11b3ec7accc70b85519c67a297b7aacb))
* Add Docs panel with Mermaid diagram support ([39f35e4](https://github.com/jscraik/narrative/commit/39f35e481ba14bdab24b61c5524f5604fcc70e15))
* add getTraceBadgeLabel helper for trace badges ([f3a7589](https://github.com/jscraik/narrative/commit/f3a7589fa93593ea45d433b17ec50b84e9494c88))
* add story anchors ([50df540](https://github.com/jscraik/narrative/commit/50df540bd47d67b554f51f4badfe05ffb1d71fb4))
* **agentation:** add critique mode and mode-aware autopilot status ([#17](https://github.com/jscraik/narrative/issues/17)) ([2b18289](https://github.com/jscraik/narrative/commit/2b1828954f0e617f7d53cf90e92db3ee2c597b67))
* **atlas:** add repo-scoped session search ([d5e6e41](https://github.com/jscraik/narrative/commit/d5e6e413378681093b5b5325760a662920427f7b))
* **capture:** activity feed, steps summary, and refreshed icon ([dc0bad8](https://github.com/jscraik/narrative/commit/dc0bad8b70807ddfb6f6ca4227f8dcdbd835c4c5))
* **capture:** auto-detect sources, codex fallback, and keychain OTLP key ([07797f9](https://github.com/jscraik/narrative/commit/07797f990d4d62af13c32dc61170c19cd7a5276d))
* complete session-to-commit linking MVP v1 ([64e8f5d](https://github.com/jscraik/narrative/commit/64e8f5d3ae97f3cb79d7e760304ae028f38499a7))
* Complete Tauri auto-updater implementation ([4055243](https://github.com/jscraik/narrative/commit/4055243a430243ad8f140a4eae85ff7a3d0445e2))
* docs linting + agent trace updates ([a3fccd2](https://github.com/jscraik/narrative/commit/a3fccd2cc9571937c8b2c5983e577852c6e17927))
* enable auto-updates, add Docs view with auto-repo-load, add release script ([b197dc1](https://github.com/jscraik/narrative/commit/b197dc1dea90b5fa1b6cb1f8cc819f36c66a518d))
* **firefly:** implement Firefly Signal System Phase 1 ([08391cf](https://github.com/jscraik/narrative/commit/08391cfba240aa639694342bbd7629caa3736a06))
* **firefly:** implement semantic state orchestration ([e5d0e9b](https://github.com/jscraik/narrative/commit/e5d0e9bd344f0197e6130c95037b4fd5b4df36b4))
* gold standard quality gates + git notes integration ([98ebf3a](https://github.com/jscraik/narrative/commit/98ebf3a5df0564a5b4d53d5af59c4948d6999f6a))
* implement narrative version control v1.0 UI/UX improvements ([25de5ee](https://github.com/jscraik/narrative/commit/25de5ee0623e4c40d8b243d9352b669783213102))
* import JUnit test runs + mentioned-files UX ([8995b69](https://github.com/jscraik/narrative/commit/8995b6950842e04cc58829fe7b520e14e269ce08))
* improve theming, session links, and agentation autopilot ([bcfdafb](https://github.com/jscraik/narrative/commit/bcfdafb205afd1864c83b45e604781a4e1bce866))
* **narrative:** add phase-1 branch narrative composer and disclosure panel ([b5bfaa0](https://github.com/jscraik/narrative/commit/b5bfaa08f3a748e9a1f48afd1badb115fd9ba2b2))
* **narrative:** add phase-3 rollout governance and kill-switch ([e99d624](https://github.com/jscraik/narrative/commit/e99d6247e5058acf858560ea3ff7927935bf17d7))
* **narrative:** implement phase-2 projections archaeology and github context ([af5cd47](https://github.com/jscraik/narrative/commit/af5cd47284fa232576e27af10a741f5719b76472))
* **Phase A:** documentation + performance tooling ([5040acf](https://github.com/jscraik/narrative/commit/5040acf228e041c0e72bbee0a1d8c57679f93f86))
* **Phase B:** testing deep dive ([1ab22e9](https://github.com/jscraik/narrative/commit/1ab22e9e44d7ca886527624b873baded6b6904d9))
* **Phase C:** accessibility improvements ([08458fa](https://github.com/jscraik/narrative/commit/08458fa76a096627e338c7a485924a119e54bb40))
* **Phase D:** architecture cleanup - modularize agent trace ([30be006](https://github.com/jscraik/narrative/commit/30be006620ca998a05645cd171c15bd54ef0ea03))
* polish UI states and harden session auto-ingest/linking ([f938510](https://github.com/jscraik/narrative/commit/f938510c3b7e428f54fc15f1da573c395a6f8cc4))
* **redaction:** expand secret detection patterns and add tests ([b62e209](https://github.com/jscraik/narrative/commit/b62e209b4c962841c7b0ff8c9f2af0826e24f038))
* Rename app to Firefly Narrative and enhance Firefly Signal UI ([b487d59](https://github.com/jscraik/narrative/commit/b487d59516245e465e811883178cf02749707cbe))
* **session-badges:** enhance with tool icons, colors, and labels ([fa5093f](https://github.com/jscraik/narrative/commit/fa5093f6c7cea41e05a581ee43fcc0d94889f560))
* **ui:** sync themes, improve layout, add mock loader ([7010cf9](https://github.com/jscraik/narrative/commit/7010cf9f173f6805fd097181f6531ebe12a14fc5))


### Bug Fixes

* Add icon field to tauri.conf.json bundle configuration ([29a8bbd](https://github.com/jscraik/narrative/commit/29a8bbd227179e323c7ebd226ec18f7cdda2763e))
* align markdownlint scope and ordering ([d23502a](https://github.com/jscraik/narrative/commit/d23502abff353beeea3363b0ffff7bcd3a807722))
* **cargo:** add default-run key to enable dev server ([3aeee16](https://github.com/jscraik/narrative/commit/3aeee16f8a114c5c7fad52adbdd50aa6ff6c1fc3))
* **ci:** repair Release workflow rust toolchain and tag input ([3894251](https://github.com/jscraik/narrative/commit/3894251b30e5542d739c9e9a117ad1307bc28eb6))
* **ci:** stabilize e2e selectors and lighthouse preview port ([52763aa](https://github.com/jscraik/narrative/commit/52763aa790e54ecac1f9a0168acb84f4f1bc1007))
* **ci:** trigger release workflow for release-please tags ([af7e414](https://github.com/jscraik/narrative/commit/af7e414e0cdf99f992142956f5642855449a380c))
* Disable auto-update check on launch (GitHub releases not ready yet) ([afca4f8](https://github.com/jscraik/narrative/commit/afca4f81e3c63b6cc4c40a484be2afff2356b6ce))
* Explicitly configure bundle targets to include DMG for macOS ([32c618b](https://github.com/jscraik/narrative/commit/32c618bd8793fb022c97e6bcdda64c3d44ef585f))
* **firefly:** skip settings persistence in dev mode ([f51b57a](https://github.com/jscraik/narrative/commit/f51b57abfb60ddcce57b8b48e82f6b38fb45d66f))
* improve error messages in secure_parser with expect() calls ([c11cdfa](https://github.com/jscraik/narrative/commit/c11cdfa2f1963968fce0414ce8b9bb7323bf4f4b))
* Improve release workflow with better caching and build steps ([ccc347a](https://github.com/jscraik/narrative/commit/ccc347a2bad44854701dc92e932a1446e8409389))
* **ingest:** codex lookup budget + hook shell escaping ([834dab9](https://github.com/jscraik/narrative/commit/834dab95d417b99e65bd4a137cd5ac1b29eedc2d))
* **ingest:** windows-safe codex watch + hooks cli lookup ([065c4f3](https://github.com/jscraik/narrative/commit/065c4f34d4326cb0da5f5852ed195197bfbe0371))
* **JSC-10:** refactor monolithic SourceLensView component ([9fea1c7](https://github.com/jscraik/narrative/commit/9fea1c74e2b88b41b9530b6ec1c54054983ad85f))
* JSC-11 add API key auth and rate limiting to OTLP receiver ([9c71fc5](https://github.com/jscraik/narrative/commit/9c71fc591b213c01ea78d31b4c0e0d0ecf46a555))
* **JSC-12:** refactor monolithic Timeline component ([e01573d](https://github.com/jscraik/narrative/commit/e01573d468aa819c947eadd068b651cda5dce12e))
* JSC-13 race condition in OTLP receiver startup ([24ad10b](https://github.com/jscraik/narrative/commit/24ad10b77c4688c00b04227fc3449f14b02ed049))
* JSC-14 silent failures in otlp_receiver error handling ([783449a](https://github.com/jscraik/narrative/commit/783449a5712cd5105204e68fa04c416fd75172c2))
* JSC-9 memory leak in diff cache with LRU cache ([5069e87](https://github.com/jscraik/narrative/commit/5069e87c3537d9f979a31fbce3631e21e624d550))
* **lint:** remove unnecessary dependency from useEffect ([ec6b9f6](https://github.com/jscraik/narrative/commit/ec6b9f60cd0a60fa00beb5e425e99b96ead45cc2))
* **narrative:** harden rollout guards and connector error handling ([4109436](https://github.com/jscraik/narrative/commit/4109436853c2e6856a43b404867f92444da2abed))
* narrow docs lint scope for CI consistency ([73747f9](https://github.com/jscraik/narrative/commit/73747f9b13d674a69167f2a2c234b82ec4f22d07))
* post-merge type errors and regex compatibility ([32f5a5d](https://github.com/jscraik/narrative/commit/32f5a5dcb3af0fafc67fc41ac57d5c0b2c5d604b))
* **release:** handle case where version is already updated ([47fb50f](https://github.com/jscraik/narrative/commit/47fb50fb61a6823320f00d09f32465eee43794f9))
* remove committed artifacts and use app data dir for db ([9d61624](https://github.com/jscraik/narrative/commit/9d61624aed4476a585815e53230936f7366f44c4))
* remove stale FireflyEvent import ([9ea1440](https://github.com/jscraik/narrative/commit/9ea1440dbd931a0a171c48acffd519f4ffca495f))
* replace runtime panics and add error logging ([3f4a3f3](https://github.com/jscraik/narrative/commit/3f4a3f3c9a0c5c9c15c419f8ff86d4fc3d7480f1))
* resolve blank window on app startup and fix linting issues ([97db77a](https://github.com/jscraik/narrative/commit/97db77a9558518e73a3491c348add158dec95923))
* resolve docs and lint CI failures ([22482bf](https://github.com/jscraik/narrative/commit/22482bfb7b6a3160a75eeb6056093663b6497e0d))
* resolve Tauri parameter naming mismatch ([31e9dbe](https://github.com/jscraik/narrative/commit/31e9dbef07f4401cf491f492798e0240480a5432))
* **sessions:** add error logging to silent catch blocks ([0428773](https://github.com/jscraik/narrative/commit/0428773499e525d46c210d2f90620a92fdc38a31))
* stabilize docs and lint CI checks ([3883718](https://github.com/jscraik/narrative/commit/388371886e56cd3ce4d3c40215a7f4d23c5b6f04))
* **story-anchors:** bundle narrative-cli resource ([cd21a1d](https://github.com/jscraik/narrative/commit/cd21a1dcacc558b1ef33ade4550719bb5bd9ca24))
* tighten otlp auth and repo loading ([aaea3c8](https://github.com/jscraik/narrative/commit/aaea3c837463def8b42daaa21515658a97111303))
* **tooling:** token lint allowlist windows path ([d6c521a](https://github.com/jscraik/narrative/commit/d6c521a127824596539c671e2bfd25bbf964b241))
* **ui:** address 14 low severity spacing, color, animation, motion issues ([b69e68e](https://github.com/jscraik/narrative/commit/b69e68e6dc1029a15a7f445f8fab8b6049944259))
* **ui:** address 17 medium severity spacing, color, animation, motion issues ([1d3afc5](https://github.com/jscraik/narrative/commit/1d3afc55068dc025c18dd00cccb8ad3cf60ab490))
* **ui:** address critical and high severity spacing, color, animation, motion issues ([8de4719](https://github.com/jscraik/narrative/commit/8de471990f82611bdf3b5938172211a9d9c395ab))
* **ui:** dialog close semantics + menu pointer ([98a936d](https://github.com/jscraik/narrative/commit/98a936dd54e59825910bf9b0909f92e884d41fcc))
* **ui:** dropdown menu a11y + close confirm dialog ([6b71799](https://github.com/jscraik/narrative/commit/6b71799f612cd6cf0b32c75f9c3a4d14ced2322f))
* **ui:** restore design system tokens in TopNav ([71a994b](https://github.com/jscraik/narrative/commit/71a994b61cdcda67a9d75ac86d267e229c0d3ef8))
* **ui:** tokens + ingest + docs baseline ([b40293d](https://github.com/jscraik/narrative/commit/b40293d2ea7a9bbdc814b00116fe4be45aa43735))
* Use correct Tauri command names for Docs panel ([f6d4909](https://github.com/jscraik/narrative/commit/f6d49095641f03f31c20246d96668aab723cc69b))
* Wire up Docs panel to sync with opened repo ([3d31131](https://github.com/jscraik/narrative/commit/3d311314b4d340dec0eebf95c6048a7f6b2e7674))

## [0.9.0](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.8.0...narrative-desktop-mvp-v0.9.0) (2026-02-17)


### Features

* **agentation:** add critique mode and mode-aware autopilot status ([#17](https://github.com/jscraik/narrative/issues/17)) ([2b18289](https://github.com/jscraik/narrative/commit/2b1828954f0e617f7d53cf90e92db3ee2c597b67))

## [0.8.0](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.7.0...narrative-desktop-mvp-v0.8.0) (2026-02-17)


### Features

* **firefly:** implement Firefly Signal System Phase 1 ([08391cf](https://github.com/jscraik/narrative/commit/08391cfba240aa639694342bbd7629caa3736a06))
* polish UI states and harden session auto-ingest/linking ([f938510](https://github.com/jscraik/narrative/commit/f938510c3b7e428f54fc15f1da573c395a6f8cc4))


### Bug Fixes

* **lint:** remove unnecessary dependency from useEffect ([ec6b9f6](https://github.com/jscraik/narrative/commit/ec6b9f60cd0a60fa00beb5e425e99b96ead45cc2))

## [0.7.0](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.6.1...narrative-desktop-mvp-v0.7.0) (2026-02-16)


### Features

* improve theming, session links, and agentation autopilot ([bcfdafb](https://github.com/jscraik/narrative/commit/bcfdafb205afd1864c83b45e604781a4e1bce866))

## [0.6.1](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.6.0...narrative-desktop-mvp-v0.6.1) (2026-02-16)


### Bug Fixes

* **ci:** stabilize e2e selectors and lighthouse preview port ([52763aa](https://github.com/jscraik/narrative/commit/52763aa790e54ecac1f9a0168acb84f4f1bc1007))
* **ingest:** codex lookup budget + hook shell escaping ([834dab9](https://github.com/jscraik/narrative/commit/834dab95d417b99e65bd4a137cd5ac1b29eedc2d))
* **ingest:** windows-safe codex watch + hooks cli lookup ([065c4f3](https://github.com/jscraik/narrative/commit/065c4f34d4326cb0da5f5852ed195197bfbe0371))
* **story-anchors:** bundle narrative-cli resource ([cd21a1d](https://github.com/jscraik/narrative/commit/cd21a1dcacc558b1ef33ade4550719bb5bd9ca24))
* **tooling:** token lint allowlist windows path ([d6c521a](https://github.com/jscraik/narrative/commit/d6c521a127824596539c671e2bfd25bbf964b241))
* **ui:** dialog close semantics + menu pointer ([98a936d](https://github.com/jscraik/narrative/commit/98a936dd54e59825910bf9b0909f92e884d41fcc))
* **ui:** dropdown menu a11y + close confirm dialog ([6b71799](https://github.com/jscraik/narrative/commit/6b71799f612cd6cf0b32c75f9c3a4d14ced2322f))
* **ui:** restore design system tokens in TopNav ([71a994b](https://github.com/jscraik/narrative/commit/71a994b61cdcda67a9d75ac86d267e229c0d3ef8))
* **ui:** tokens + ingest + docs baseline ([b40293d](https://github.com/jscraik/narrative/commit/b40293d2ea7a9bbdc814b00116fe4be45aa43735))

## [0.6.0](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.5.0...narrative-desktop-mvp-v0.6.0) (2026-02-15)


### Features

* gold standard quality gates + git notes integration ([98ebf3a](https://github.com/jscraik/narrative/commit/98ebf3a5df0564a5b4d53d5af59c4948d6999f6a))
* **Phase A:** documentation + performance tooling ([5040acf](https://github.com/jscraik/narrative/commit/5040acf228e041c0e72bbee0a1d8c57679f93f86))
* **Phase B:** testing deep dive ([1ab22e9](https://github.com/jscraik/narrative/commit/1ab22e9e44d7ca886527624b873baded6b6904d9))
* **Phase C:** accessibility improvements ([08458fa](https://github.com/jscraik/narrative/commit/08458fa76a096627e338c7a485924a119e54bb40))
* **Phase D:** architecture cleanup - modularize agent trace ([30be006](https://github.com/jscraik/narrative/commit/30be006620ca998a05645cd171c15bd54ef0ea03))


### Bug Fixes

* post-merge type errors and regex compatibility ([32f5a5d](https://github.com/jscraik/narrative/commit/32f5a5dcb3af0fafc67fc41ac57d5c0b2c5d604b))

## [0.5.0](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.4.0...narrative-desktop-mvp-v0.5.0) (2026-02-11)


### Features

* **redaction:** expand secret detection patterns and add tests ([b62e209](https://github.com/jscraik/narrative/commit/b62e209b4c962841c7b0ff8c9f2af0826e24f038))
* **session-badges:** enhance with tool icons, colors, and labels ([fa5093f](https://github.com/jscraik/narrative/commit/fa5093f6c7cea41e05a581ee43fcc0d94889f560))


### Bug Fixes

* **cargo:** add default-run key to enable dev server ([3aeee16](https://github.com/jscraik/narrative/commit/3aeee16f8a114c5c7fad52adbdd50aa6ff6c1fc3))

## [0.4.0](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.3.1...narrative-desktop-mvp-v0.4.0) (2026-02-09)


### Features

* add story anchors ([50df540](https://github.com/jscraik/narrative/commit/50df540bd47d67b554f51f4badfe05ffb1d71fb4))
* **atlas:** add repo-scoped session search ([d5e6e41](https://github.com/jscraik/narrative/commit/d5e6e413378681093b5b5325760a662920427f7b))
* **capture:** activity feed, steps summary, and refreshed icon ([dc0bad8](https://github.com/jscraik/narrative/commit/dc0bad8b70807ddfb6f6ca4227f8dcdbd835c4c5))
* **capture:** auto-detect sources, codex fallback, and keychain OTLP key ([07797f9](https://github.com/jscraik/narrative/commit/07797f990d4d62af13c32dc61170c19cd7a5276d))

## [0.3.1](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.3.0...narrative-desktop-mvp-v0.3.1) (2026-02-07)


### Bug Fixes

* **ci:** trigger release workflow for release-please tags ([af7e414](https://github.com/jscraik/narrative/commit/af7e414e0cdf99f992142956f5642855449a380c))

## [0.3.0](https://github.com/jscraik/narrative/compare/narrative-desktop-mvp-v0.2.0...narrative-desktop-mvp-v0.3.0) (2026-02-07)


### Features

* add analytics dashboard with drill-down navigation ([cba4184](https://github.com/jscraik/narrative/commit/cba41844be69b373363faad42dfa3dce47480ef9))
* add attribution notes metadata and CI icons ([91b1938](https://github.com/jscraik/narrative/commit/91b1938b11b3ec7accc70b85519c67a297b7aacb))
* Add Docs panel with Mermaid diagram support ([39f35e4](https://github.com/jscraik/narrative/commit/39f35e481ba14bdab24b61c5524f5604fcc70e15))
* add getTraceBadgeLabel helper for trace badges ([f3a7589](https://github.com/jscraik/narrative/commit/f3a7589fa93593ea45d433b17ec50b84e9494c88))
* complete session-to-commit linking MVP v1 ([64e8f5d](https://github.com/jscraik/narrative/commit/64e8f5d3ae97f3cb79d7e760304ae028f38499a7))
* Complete Tauri auto-updater implementation ([4055243](https://github.com/jscraik/narrative/commit/4055243a430243ad8f140a4eae85ff7a3d0445e2))
* docs linting + agent trace updates ([a3fccd2](https://github.com/jscraik/narrative/commit/a3fccd2cc9571937c8b2c5983e577852c6e17927))
* enable auto-updates, add Docs view with auto-repo-load, add release script ([b197dc1](https://github.com/jscraik/narrative/commit/b197dc1dea90b5fa1b6cb1f8cc819f36c66a518d))
* implement narrative version control v1.0 UI/UX improvements ([25de5ee](https://github.com/jscraik/narrative/commit/25de5ee0623e4c40d8b243d9352b669783213102))
* import JUnit test runs + mentioned-files UX ([8995b69](https://github.com/jscraik/narrative/commit/8995b6950842e04cc58829fe7b520e14e269ce08))


### Bug Fixes

* Add icon field to tauri.conf.json bundle configuration ([29a8bbd](https://github.com/jscraik/narrative/commit/29a8bbd227179e323c7ebd226ec18f7cdda2763e))
* **ci:** repair Release workflow rust toolchain and tag input ([3894251](https://github.com/jscraik/narrative/commit/3894251b30e5542d739c9e9a117ad1307bc28eb6))
* Disable auto-update check on launch (GitHub releases not ready yet) ([afca4f8](https://github.com/jscraik/narrative/commit/afca4f81e3c63b6cc4c40a484be2afff2356b6ce))
* Explicitly configure bundle targets to include DMG for macOS ([32c618b](https://github.com/jscraik/narrative/commit/32c618bd8793fb022c97e6bcdda64c3d44ef585f))
* improve error messages in secure_parser with expect() calls ([c11cdfa](https://github.com/jscraik/narrative/commit/c11cdfa2f1963968fce0414ce8b9bb7323bf4f4b))
* Improve release workflow with better caching and build steps ([ccc347a](https://github.com/jscraik/narrative/commit/ccc347a2bad44854701dc92e932a1446e8409389))
* **JSC-10:** refactor monolithic SourceLensView component ([9fea1c7](https://github.com/jscraik/narrative/commit/9fea1c74e2b88b41b9530b6ec1c54054983ad85f))
* JSC-11 add API key auth and rate limiting to OTLP receiver ([9c71fc5](https://github.com/jscraik/narrative/commit/9c71fc591b213c01ea78d31b4c0e0d0ecf46a555))
* **JSC-12:** refactor monolithic Timeline component ([e01573d](https://github.com/jscraik/narrative/commit/e01573d468aa819c947eadd068b651cda5dce12e))
* JSC-13 race condition in OTLP receiver startup ([24ad10b](https://github.com/jscraik/narrative/commit/24ad10b77c4688c00b04227fc3449f14b02ed049))
* JSC-14 silent failures in otlp_receiver error handling ([783449a](https://github.com/jscraik/narrative/commit/783449a5712cd5105204e68fa04c416fd75172c2))
* JSC-9 memory leak in diff cache with LRU cache ([5069e87](https://github.com/jscraik/narrative/commit/5069e87c3537d9f979a31fbce3631e21e624d550))
* **release:** handle case where version is already updated ([47fb50f](https://github.com/jscraik/narrative/commit/47fb50fb61a6823320f00d09f32465eee43794f9))
* remove committed artifacts and use app data dir for db ([9d61624](https://github.com/jscraik/narrative/commit/9d61624aed4476a585815e53230936f7366f44c4))
* replace runtime panics and add error logging ([3f4a3f3](https://github.com/jscraik/narrative/commit/3f4a3f3c9a0c5c9c15c419f8ff86d4fc3d7480f1))
* resolve blank window on app startup and fix linting issues ([97db77a](https://github.com/jscraik/narrative/commit/97db77a9558518e73a3491c348add158dec95923))
* resolve Tauri parameter naming mismatch ([31e9dbe](https://github.com/jscraik/narrative/commit/31e9dbef07f4401cf491f492798e0240480a5432))
* tighten otlp auth and repo loading ([aaea3c8](https://github.com/jscraik/narrative/commit/aaea3c837463def8b42daaa21515658a97111303))
* Use correct Tauri command names for Docs panel ([f6d4909](https://github.com/jscraik/narrative/commit/f6d49095641f03f31c20246d96668aab723cc69b))
* Wire up Docs panel to sync with opened repo ([3d31131](https://github.com/jscraik/narrative/commit/3d311314b4d340dec0eebf95c6048a7f6b2e7674))

## Changelog

All notable changes to Narrative MVP will be documented in this file.

This project uses automated release notes (Release Please). Human edits are OK,
but release notes should remain accurate and reflect what shipped.

## Unreleased

- (pending)
