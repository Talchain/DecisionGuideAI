# Lane UI-W4 — producer consumption (branch `claude-lane12/producer-consumption`)

**Date:** 2026-07-07 · **Base:** `origin/staging` @ `a131d954` (includes #236 typed Phase-3 rendering) · **Repo:** DecisionGuideAI (writes confined here)
**Producers consumed:** PLoT #200 (staging `85e06d7d`) — `decision_brief.headline_banded` + `_meta.evidence`; ISL staging `9a22a1ae` (build id evidenced via the PLoT passthrough).
**Doctrine:** UI renders, never invents; producers own semantics. Wording surfaces tagged `provisional_doctrine_v0`. All boundary-adjacent changes ADDITIVE.

## Commits

| Commit | Feature |
|---|---|
| `df490512` | A — consume `decision_brief.headline_banded` (producer leg of UI-SEM-060) |
| `fc5465a0` | B — consume `_meta.evidence` in the debug exporter (diligence gap) |
| `1bd899a0` | C — render 0.13.1 `evidence` + `exercise` blocks (Track C slice 2) |

## A — Consume `decision_brief.headline_banded` (UI-SEM-060 producer leg)

PLoT #200 emits the leader-confidence band the hero's UI-SEM-060 banding existed to fake: `band` (`very_close` / `slightly_ahead` / `clearly_ahead`), leader identity, `win_probability_gap`, and `robustness_gated` (true when a clearly-ahead gap was downgraded producer-side because robustness was not established). The inventory row's own note was "Remove when PLoT provides a leader-confidence band / close-call signal".

**Data path (traced producer → validator → consumer):** PLoT `/v2/run` `decision_brief.headline_banded` → `V2RunResponse.decision_brief` (additive open typing, `src/adapters/plot/v2/types.ts`) → `mapV2ResponseToReportV1` verbatim pass-through (survives save + hydrate; same pattern as `flip_thresholds`) → `useResultsSectionData` recommendation memo (mapped report first, raw `rawV2Response` second) through **`normalizeHeadlineBanded`** (`src/components/results/types.ts`) — the fail-closed trust boundary: exactly the three band tokens + non-empty `leader_option_id`, unknown tokens → `null` → `recommendation.headlineBanded` → `buildHeroModel`.

**Consumption rule (buildHeroModel):** the producer band drives the banded no-goal-basis leader copy when present AND naming the SAME leader the hero headlines (identity gate — a producer claim about option X is never applied to option Y; a mismatch falls back). Bands map onto EXISTING copy only (no new wording): `clearly_ahead` → "most likely to be strongest overall", `slightly_ahead` → "slightly ahead", `very_close` → "No option is clearly ahead." `robustness_gated` is carried as disclosure metadata only — the downgrade is already folded into the band by the producer, so no UI copy keys off it. The UI's win-probability banding remains ONLY as the absent-producer fallback (older build / single-option run / failed normalisation / leader mismatch).

**Inventory updated:** CLAUDE.md UI-SEM-060 row annotated **producer-consumed** with the residual-fallback removal condition ("remove when the producer band is guaranteed on every ≥2-option run"); `buildHeroModel` / `heroCopy` UI-SEM-060 comments rewritten producer-first. UI-SEM-070 (readout-tie subline gate) is deliberately NOT retired: it gates on rendered expected-outcome readout equality, a different quantity from the win-probability band.

**Producer's `text` sentence deliberately not rendered:** hero copy stays the glossary-scanned strings in `heroCopy.ts` selected by band (per brief: "Bands map to existing copy; no new wording inventions").

## B — Consume `_meta.evidence` in the debug exporter (chronicle items 20/21)

PLoT #200 ships an always-present additive `_meta.evidence` (EvidenceCaptureV1): sha256 digests over the EXACT ISL wire bytes (request + response: `sha256`, `bytes`, sorted `key_manifest`) plus `plot_build` / `isl_build`. Before this, the bundle reported "plot: null / isl: null" (`builds` / `schema_versions.build_ids`) because the full payload mirror is gated behind `UI_CANONICAL_META` (off in staging) and ISL is called by PLoT, never directly by the UI.

**What landed (all additive):**
- `bundle.evidence_capture` (`src/components/debug/utils/exportBundle.ts`): verbatim fail-closed mirror — `source: 'plot_response._meta.evidence'`, `plot_build`, `isl_build`, `isl_request_digest`, `isl_response_digest`. Absent producer field → `null` area; malformed digest/build → `null` field. PLoT's honest nulls (ISL not exercised) are carried verbatim, never invented over.
- `schema_versions.build_ids.plot/isl`: fall back to the evidence builds ONLY when the legacy capture-time extraction found nothing; a legacy-extracted build is never overwritten.
- `useDebugData.extractBuildVersions`: same additive last-fallbacks at capture time, so live `builds` are populated too.

## C — Render `evidence` + `exercise` blocks (Track C slice 2)

Closes lane UI-R3's recorded follow-up #2 using the EXACT #236 pattern (typed adapters from the vendored 0.13.1 Zod shapes, producer-verbatim copy, fail-closed null, counter rationales updated).

- Typed blocks `v5_evidence` / `v5_exercise` (`src/canvas/conversation/types.ts`), distinct from the legacy V4-era `evidence`/`exercise` ConversationBlocks (different shapes). `severity` enum-narrowed (visual channel); `current_confidence` / `exercise_kind` are open pass-through discriminators riding `data-*` only.
- Adapters (`src/v5/phase3TypedBlocks.ts`): exactly the typed fields; unknown subfields ignored at any depth; fail-closed → null. Schema-declared metadata (`signal_id`/`created_at`/`source_handler`/`graph_hash_at_generation`) NOT required (live staging omits it on the other Phase 3 types). Exercise: NO title and NO `priority_rank` per the v1.3 contract; requires ≥1 producer prose field — a content-less card fails closed (no empty shells). Malformed single-ref slots (`factor_ref`, `target_element_ref`) are omitted without suppressing the block.
- Bridge (`composePhase3BridgedBlocks`): evidence joins the shared producer `priority_rank` ascending ordering; exercise takes +Infinity rank (after every ranked block, harvest order preserved — the established missing-rank convention). Dedupe by `block_id` extended to the new types. Malformed → counted `malformed_phase3_block_suppressed`.
- Renderers `V5EvidenceBlock.tsx` / `V5ExerciseBlock.tsx` in the slice-1 idiom (bg-panel, border via opacity, Lucide only). Evidence title = the PRIMARY factor `target_refs` label per contract §1.3 (preferred over the backward-compat `factor_label` on conflict), then the three producer paragraphs with NO invented headings. Exercise renders only the producer prose fields present + `warning_signs` list + reference pills. `action_label` stays a display-only pill (the slice-1 `action_intent` dispatch follow-up remains open).
- `InlineBlocks` dispatch + DS badge dots (evidence: severity rule shared with review cards; exercise: info). `mapV5Blocks` maps schema-strict evidence/exercise (runtime-unreachable today — the parser sidecar diverts them — kept coherent like slice 1 did for coaching/review_card).
- `droppedContentCounter`: `no_renderer_for_block_type` documented RETIRED (no live drop point emits it; literal kept for old-bundle compat). **Deliberate superseded test contract:** the slice-1 bridge test pinning evidence/exercise to `no_renderer_for_block_type` is re-rationalised to `malformed_phase3_block_suppressed` (its bare `{type, block_id}` shapes are adaptation failures now that renderers exist) — commented in the spec.

**Fixture honesty:** no live staging capture carries evidence/exercise blocks yet, so `src/v5/__tests__/fixtures/phase3-evidence-exercise.bundle-shaped.json` is bundle-shaped synthetic — pinned to the contract by parsing EVERY fixture block against the REAL vendored `EvidenceBlockSchema` / `ExerciseBlockSchema` inside the suite (fixture-vs-contract drift fails the tests first).

## Tests & verification

All RED→GREEN stash-verified on this worktree (implementation stashed → failures; restored → green):

| Feature | RED (impl stashed) | GREEN | Suites |
|---|---|---|---|
| A | 18 failures | 149/149 | `headlineBanded.normalizer.spec`, `buildHeroModel.spec` (producer-band describe: preference over fallback, identity-gate mismatch, absent-fallback, goal-basis non-interference), `responseMapper.spec` (verbatim pass-through) |
| B | 5 failures | 7/7 | `exportBundle.evidenceCapture.spec` (verbatim mirror, honest nulls, per-field fail-closed, build_ids fallback/precedence/no-invention) |
| C | 35 failures | 84/84 | `phase3TypedBlocks.spec` (+contract pin), `phase3TypedBridge.spec`, `V5Phase3Blocks.spec` |

- Slice-1 contracts pass UNCHANGED: `phase3ReviewCardBridge.spec` + `.liveFixture.spec` (116/116 combined with slice-2 suites).
- Debug directory sweep: 554 passed, 1 pre-existing failure (below).
- Wider sweep `src/v5` + `src/canvas/conversation/__tests__` + counter: **1878 passed / 98 failed — failure count IDENTICAL to the clean `a131d954` tree (98)**; the 98 are pre-existing local-env/mock failures (same class lane9 documented), zero introduced.
- **Typecheck:** `pnpm run typecheck` (tsconfig.ci) clean after every feature; `npx tsc -p tsconfig.app.json --noEmit` error count 2331 == clean-tree baseline 2331 (stash-compared on this worktree).
- **Lint:** 0 errors on all changed files (remaining warnings pre-existing).

### Pre-existing failures NOT introduced by this lane (verified on the CLEAN base tree)
- `exportBundle.displayState.spec.ts` — `results_stale` case: 1 failure on a clean `origin/staging` (`a131d954`) checkout, identical with this lane's changes.
- The 98-failure `src/canvas/conversation` broad-dir class (env-dependent suites importing `src/lib/supabase.ts`): identical counts with and without this lane's changes. `.env.local` copied from the main checkout into the worktree (gitignored, NOT committed) to run the supabase-importing suites at all — same local-env situation lane9 recorded.

## Boundary audit (additive-only rule)

- `V2RunResponse.decision_brief` — new OPTIONAL field, open record; nothing existing narrowed.
- `ReportV1` pass-through — conditional spread, key absent when producer omits it.
- `DecisionResultData.headlineBanded` — new optional field.
- Bundle `evidence_capture` — new top-level area; `schema_versions.build_ids` fallback fills previously-null values only.
- Conversation `v5_evidence`/`v5_exercise` — new union members; no existing block type changed.
- No non-additive boundary change was needed; nothing to STOP on.

## Follow-ups (recorded, not done)
1. Remove the UI-SEM-060 residual fallback banding once the producer band is guaranteed on every ≥2-option run (needs PLoT confirmation that `BRIEF_CLAIM_SAFE_SURFACES_ENABLE` stays default-ON in prod and brief assembly cannot be skipped on computed runs).
2. UI-SEM-070 retirement still needs a producer close-call signal grounded in expected-outcome readouts (the win-probability band is a different quantity).
3. Wire `action_intent`/`action_label` on ALL typed Phase 3 blocks (review_card/coaching/evidence) to turn dispatch — carried over from slice 1.
4. Replace the bundle-shaped evidence/exercise fixture with a real staging capture once CEE emits these types on the live wire.
5. Debug-panel UI surface for `bundle.evidence_capture` (exported in the bundle JSON only this lane).
