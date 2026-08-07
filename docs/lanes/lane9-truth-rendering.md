# Lane UI-R3 — truth rendering (branch `claude-lane9/truth-rendering`)

**Date:** 2026-07-07 · **Base:** `origin/staging` @ `bd247d3a` · **Repo:** DecisionGuideAI (writes confined here)
**Scope:** roadmap 2.2 slice-1 (Track C, D-5 approved), 1.7, 1.12 — Paul-approved, accelerated.
**Doctrine:** UI renders, never invents; producers own semantics. Wording surfaces tagged `provisional_doctrine_v0`. All boundary-adjacent changes ADDITIVE.

## Commits

| Commit | Feature |
|---|---|
| `f9b76330` | B (1.7) factor influence passthrough + C (1.12) warning-severity surfacing |
| `f7709fbc` | A (2.2 slice 1) render 0.13.x `coaching` + `review_card` blocks |

## A — Render coaching + review_card blocks (Track C slice 1)

**Registry/dispatch identified:** parser-side `PHASE3_TOLERATED_BLOCK_TYPES` + `LEGACY_SCHEMA_KNOWN_BLOCK_TYPES` (`src/v5/responseParser.ts`) divert Phase 3 types into the `__additive__` sidecar pre-validation; render dispatch = `mapV5Blocks` → `composePhase3BridgedBlocks` (`useConversation.ts`) → `InlineBlocks` `BlockRenderer`. The parser is UNCHANGED: truly-unknown types keep counting (`unknown_block_type_dropped_pre_validation`).

**What landed:**
- Typed conversation blocks `v5_review_card` / `v5_coaching` (`src/canvas/conversation/types.ts`) mirroring the vendored 0.13.1 Zod shapes exactly: title, body, severity/card_kind (review) · coaching_kind/source (coaching), target_refs `{id,label,kind}`, priority_rank, freshness, optional action_intent/action_label.
- Adapters `src/v5/phase3TypedBlocks.ts`: read EXACTLY the typed fields; unknown subfields ignored at every depth; fail-closed → `null` on missing/mistyped required render-relevant fields. Schema-declared metadata (`created_at`, `signal_id`, …) deliberately NOT required — the live staging capture (`cee-response-b82c89dd-trimmed.json`) omits `created_at`, and a producer block must not be suppressed over metadata the UI never shows.
- Renderers `src/v5/blocks/V5ReviewCardBlock.tsx` / `V5CoachingBlock.tsx` in the existing V5 block idiom (bg-panel card, border via opacity, Lucide icons). Severity drives the visual channel only; card_kind/coaching_kind/freshness/block_id ride `data-*` attributes, never copy. `action_label` renders as a display-only outlined pill (see follow-ups).
- Bridge (`composePhase3BridgedBlocks`): typed-first — ALL schema-valid coaching/review cards render, producer `priority_rank` ascending (no new ranking invented), deduped by `block_id`, NOT gated on the run_analysis fact (CEE owns emission; coaching legitimately arrives on draft turns). Legacy-shaped review cards keep the ORIGINAL fact-gated top-1 fallback byte-for-byte (`phase3ReviewCardBridge.spec.ts` passes unchanged).
- Fail-closed counting via `droppedContentCounter` (new source `phase3_block_bridge`): malformed coaching/review_card → `malformed_phase3_block_suppressed`; evidence/exercise → `no_renderer_for_block_type`; unsurfaced legacy cards → `legacy_review_card_suppressed`. Counting never alters composition.

**Superseded test contract (deliberate):** `phase3ReviewCardBridge.liveFixture.spec.ts` previously locked "top-1 legacy review_card, coaching never surfaces". Its fixture blocks are REAL 0.13.x shapes, so they now render via the typed path; the spec was updated to the approved slice-1 contract. The legacy fallback contract remains locked by the untouched unit spec (its fixtures are genuinely legacy-shaped).

## B — Factor-card influence rendering (1.7)

`mapV5AnalysisToReport` narrowed `factor_sensitivity` to `{factor_id, factor_label, sensitivity, direction}`, dropping `influence_score` before the store. Now `influence_score` / `influence_rank` / `zero_reason` pass through additively (verbatim, no defaults, omitted when absent) → `normalizeFactorSensitivity` → `DriverItem`. The existing DriversSection "Influence" column (`driver.influenceScore ?? normalisedInfluence`) therefore now renders the PRODUCER's influence on the V5 path instead of UI-normalised sensitivity (provisional_doctrine_v0: influence ≠ sensitivity; user-facing copy in DriversSection is already "Influence"/"influence", never "sensitive").

Material behaviour fix proven by test: the pinned factor in the live bundle (`fac_marketing_expertise`, `influence_score` 1, `sensitivity_score` 0, `zero_reason` `intervention_override`) was previously dropped by the zero-impact filter on the V5 path; it now stays visible with its influence bar, and its only explanatory copy is the existing zero-reason line "Directly controlled by your options" (no sensitivity-flavoured copy; elasticity copy is gated on `rawElasticity > 0.001`).

## C — Warning surfacing (1.12)

`enrichment.inference_warnings` now passes through the V5 mapper verbatim onto the widened report; the selector keeps producer `severity`; new `InferenceWarningStrip` (`src/components/results/InferenceWarningStrip.tsx`) mounts in `ResultsBody` directly below `AnalysisFreshnessNotice` (same visual idiom). Renders ONLY `severity === 'warning'` entries; copy = producer `message` verbatim; info-severity stays hidden; no message → nothing (no fabricated copy from `code`); renders nothing when empty. Note: entries without a severity are NOT promoted; severities other than `warning` are out of this brief's scope and stay off this strip.

Cross-lane sequencing note: the strip is generic over the EXISTING `inference_warnings` field (present in the captured staging bundle); no code-specific handling of `CONSTRAINT_TARGET_UNRELIABLE` was added — it is only the fixture example of a warning-severity value.

## Tests & verification

Fixtures: real captured shapes from `~/Downloads/olumi-debug-45c9b625-20260707.json` → committed as `src/v5/__tests__/fixtures/v5-analysis-result.bundle-45c9b625.json` (real factor ids/influence values/warning shapes; one synthetic `CONSTRAINT_TARGET_UNRELIABLE` warning-severity entry appended per producer-documented shape — see fixture `_provenance`). Feature A additionally uses the pre-existing live staging fixture `cee-response-b82c89dd-trimmed.json` (real 0.13.x coaching/review cards).

- **RED→GREEN (B+C):** with mapper/selector changes stashed, the new specs fail 6; restored, 15/15 pass (`mapV5AnalysisToReport.influence-warnings.spec.ts`, `influence-warnings.wire-to-selector.spec.tsx`, `InferenceWarningStrip.spec.tsx`).
- **RED→GREEN (A):** with the bridge change stashed, `phase3TypedBridge.spec.ts` fails 9/10; restored, 82/82 pass across bridge/adapters/renderers/mapV5Blocks/live-fixture suites.
- **Regression sweep:** 1278 tests across 106 files (lib + parser dropped-content + InlineBlocks DS v5) pass; parser tolerance, counter, block-renderer, blockAdapter/blockSchemaAlignment suites pass (86/86).
- **Typecheck:** `pnpm run typecheck` (tsconfig.ci) clean; `npx tsc -p tsconfig.app.json --noEmit` error count 2331 == clean-baseline 2331 (measured via stash on the fresh worktree).
- **Lint (touched files):** 0 errors; 13 warnings, all pre-existing (console statements / exhaustive-deps in untouched regions).

### Pre-existing failures NOT introduced by this lane (verified identical with changes stashed)
- `ResultsBody.heroPlacement.spec.tsx`: 3 failures on the clean `bd247d3a` tree.
- `src/canvas/conversation/__tests__` broad-dir run: environment-dependent failures (e.g. `analysisInputsWiring`, `aiPanelTranche1`, `conversation-flow`: 21 failures) — identical counts with and without this lane's changes. Cause: local env — suites importing `src/lib/supabase.ts` need `.env.local` (copied from the main checkout, gitignored, NOT committed), while that same env flips flag-dependent expectations in other suites. CI with its own env remains the authoritative gate.

## Follow-ups (recorded, not done)
1. Wire `action_intent`/`action_label` on typed Phase 3 blocks to the existing chip/turn dispatch (`ACTION_TO_TURN_TYPE`) — display-only pill this slice; next round.
2. Evidence/exercise renderers (currently counted `no_renderer_for_block_type`).
3. Consider surfacing `influence_rank` visually (currently typed + plumbed to `DriverItem.influenceRank`, not rendered; ordering remains rank-by-elasticity as before — changing driver ordering was out of additive scope).
4. Reload-persistence of rendered Phase 3 blocks (thread hydration path) — Track C acceptance item, separate slice.
