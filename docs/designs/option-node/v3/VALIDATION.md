# Current delivery validation — 9 September 2026

Candidate branch: `codex/option-node-followups`. No local test/build/install was run under the shared resource directive. Whitespace validation only: `git diff --check` passed. Hosted CI and independent review are required before release.

| Acceptance | Authored check | Deployed artefact |
|---|---|---|
| Missing result differs from failed result and measured zero in one graph | `OptionNode.deliveryStates.spec.tsx`, real store and display selector | Not yet witnessed |
| Draft is not falsely called an unavailable analysis | Same suite, draft control | Not yet witnessed |
| Baseline with values does not claim no changes | Same suite, baseline differs from observed value | Not yet witnessed |
| Capped preview has a working inspector overflow route | Same suite, five interventions | Not yet witnessed |
| Unavailable coaching explains an unsent prompt; registration recovers | `NodeChip.unavailable.spec.tsx`, real guidance store, no toast host | Not yet witnessed |
| Existing dispatcher intent and legacy send remain intact | New recovery test plus existing NodeChip intent/canonical-run suites | Not yet witnessed |
| Global influence does not claim why an option won | Existing OptionNode factor-identity fixtures with superseded causal copy | Not yet witnessed |

The remaining inspector, currentness, graph and semantic-model rows retain their owners in [DESIGN-SPEC.md](DESIGN-SPEC.md). The three independently reviewed Canvas releases (#1274, #1339, #1340) are merged; this does not establish their paint/journey acceptance. Do not run local broad checks to fill these gaps while the resource directive stands.

---

> Delivery update, 9 September 2026: this is historical #1333 validation. The current [delivery register](DESIGN-SPEC.md#delivery-register) contains additional unresolved acceptance rows. No new source or deployed journey pass is implied. Further checks use hosted CI while the shared Mac is under a no-local-tests/builds directive.

# V3 validation record

Recorded on 8 September 2026 for `codex/option-node-v3-refinements`, based on
staging `25164b1e`. Scope and expected behaviour are in
[DESIGN-SPEC.md](DESIGN-SPEC.md).

Application change: `e89a206c`. Review:
[PR #1333](https://github.com/Talchain/DecisionGuideAI/pull/1333), targeting
staging. Later documentation-only commits do not change the tested application.

## Automated checks

| Check | Result |
|---|---|
| Initial node, action and menu regression group | 175 tests passed across 7 files. |
| Follow-up context-menu and tooltip group | 45 passed across 3 files; 35 repeat the initial group, 10 are additional menu tests. |
| Inspector rename, reachability, authority and review-fix group | 55 passed across 4 files. |
| Final shared-tooltip change | All 6 preview/tooltip tests passed on the final code. |
| Unique targeted coverage across the above groups | 240 tests across 12 files. Repeated tests are counted once. |
| Repository typecheck gate | Passed coverage and per-file ratchet: 4247 of 4287 tracked TypeScript files loaded, 40 declared out of scope; 2104 existing diagnostics against baseline 2152, none added. Baseline unchanged. |
| Full lint and hooks ratchet | Passed: 0 errors, 1163 existing warnings; 225 known hook violations match the baseline. |
| Additional lint on the final tooltip and inspector edits | Passed. |
| Critical data-flow smoke suite | 600 tests passed across all 9 named files, in an isolated checkout of `e89a206c`. |
| Design-system drift, stale JavaScript and dependency integrity checks | Passed. These integrity checks are separate from the CI vulnerability audit below. |

The inspector group initially could not collect because the test process lacked
the repository's dummy local Supabase settings. Supplying those settings made
all 55 tests run and pass; no production configuration was changed. One repeat
of the tooltip suite hit its five-second test timeout under local load; a
fresh run passed all six in 1.14 seconds. No timeout was increased and no
assertion was removed.

The full repository test suite was not run locally. The checkout had
`core.hooksPath=/dev/null`, so the normal release script was invoked explicitly.
Its first smoke run stalled when the CSS census followed the parent directory's
`node_modules` symlink into the assistants-service checkout and blocked reading
an unrelated type package. That run was stopped and is not counted as a pass.
All 9 smoke files were then rerun at the same commit in an isolated checkout;
all 600 passed. The other release-script checks passed; its changed-file lint
step skipped because the branch had already been pushed, so the explicit full
and final-file lint results above remain the lint evidence.

## Browser checks

The eight captures and their check descriptions are in
[IMPLEMENTATION.md](IMPLEMENTATION.md#browser-evidence). They cover an actual
connected application graph, action/body preview precedence, hoverable
tooltips, keyboard disclosure, Challenge opening an unsent draft, the details
menu route, a long inspector title, viewport-edge positioning and real zoom.

The local application used a captured headcount starter through
`applyDraftResult`, checked-in Netlify feature declarations and offline API
routes. Checks ran at 1440 × 900 and 1280 × 800, at 50% and 100% zoom.
No real user scenario or external AI request was used.

## Evidence boundary

Application code and local interaction checks exist. These checks do not
establish staging deployment, live AI response quality, a two-person journey,
new reasoning-signal coverage or the complete V3 vision. The existing control
size still reduces with canvas zoom. Deployment acceptance must identify the
served build and repeat the relevant interactions there.

## CI release blocker recorded during review

The production build, CEE contract validation, TypeScript/lint, typecheck
self-test, advisory canvas browser and advisory core E2E checks passed for
`e89a206c`.
The [CI security audit](https://github.com/Talchain/DecisionGuideAI/actions/runs/34272060888/job/102216127450)
failed on four high-severity `fast-uri` advisories. The existing lockfile
resolves `ajv → fast-uri@3.1.5`; neither the manifest nor the lockfile differs
from the staging base in this PR. This is an existing dependency issue, not a
new dependency introduced by the node refinement. The audit reports patched
versions beginning at 3.1.6.

Dependency maintenance must resolve that audit and rerun it before release
clearance. This record is not an all-CI-green verdict, and no merge or staging
deployment has been performed.

The [advisory visual regression job](https://github.com/Talchain/DecisionGuideAI/actions/runs/34272060888/job/102216127716)
also failed: 10 state images and the unmodified-capture tolerance control
differed from their references. The control reported a difference ratio of
0.0256813. That result does not by itself distinguish stale references from a
new regression. No snapshots were re-approved; compare with a base-commit run
before attributing or accepting those differences.

## 8 September review update

At `e77f8a31043d48ec6a7d3a74726daafe74eff322`, all four hosted full-suite shards, Full Test Suite Summary and Staging Gate pass. The preceding head's shard-2 failure was ours: the Canvas foreign-component census lacked the newly imported, portalled shared Tooltip. The repair adds that exact inventory entry and corrects the stale justification; it does not counter-scale the tooltip or change production code. No local test pass is claimed for the repair under excessive host load. Security Audit and advisory Visual Regression remain failed; neither is waived.

Claude Code Canvas completed an independent source review at that head: [review receipt](https://github.com/Talchain/DecisionGuideAI/pull/1333#issuecomment-5592356351). It found no production blocker in the reviewed scope, flagged redundant screen-reader tooltip descriptions, identified an untested Escape/inspector interaction, and required removal of the rejected V3 prototype from merge content. Its browser leg is explicitly unperformed because host load exceeded the repository guard. This is not complete acceptance.

The subsequent reference update changes documentation only: premium V2 component sheet, current specification and entry point. Rejected V3 HTML/template/build assets and their prototype images are removed from the PR's tracked content; local historical files remain. Application source remains unchanged from the reviewed head.

The refined component sheet was opened locally at 1440 × 900 and 1280 × 800. DOM checks covered rendered node and inspector, non-overflowing layout, full long title, description disclosure, missing origin and inputs, conditional cue, unavailable quick actions, the preview coaching chip, local rename, and the More → Open details excerpt. Tooltip and body-preview visibility states were exercised; no timing benchmark or production browser acceptance is claimed under the current host load. Every AI action explains its actual route without simulating an AI answer. These checks are for the reference file only.
