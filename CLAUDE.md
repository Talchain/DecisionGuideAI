# DecisionGuideAI - Project Instructions

Project context and conventions for Claude Code.

## Project Overview

DecisionGuideAI is a decision modeling tool with an interactive canvas interface for building and analyzing decision graphs. Built with React, TypeScript, Vite, and Tailwind CSS.

## Design System

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the quick reference. Full specification: [`docs/design/Olumi_Design_System_v4.md`](docs/design/Olumi_Design_System_v4.md). Key rules:

- **Three-channel system**: Shapes (what it is) · Colour (how it's doing) · Icons (what you can do) — no channel duplicates another
- Two shades per colour: main (text/icons) + light (canvas node fills and panel entity-hover only)
- `bg-{colour}-light` is **never** used on cards, banners, pills, or coaching cards — use `bg-panel`
- Borders via opacity (`border-danger/30`), never extra shade tokens
- Pills: outlined only (`bg-transparent border-{colour}/30 text-text-body`) — never filled, never `text-{colour}`
- Primary button: `bg-primary text-text-on-color` (info blue with white text)
- Font: Inter throughout. Icon library: Lucide only. No emoji in production UI.
- New code should use semantic names (`text-info`, `bg-panel`), not legacy aliases (`sky-500`, `mint-500`)

## Architecture: CEE → UI → PLoT Data Flow

- CEE response → `adaptDraftResponse()` (cee/client.ts) → DraftChat node mapping → canvas store → V2 adapter (`transformNodeToV2`, `extractObservedState`) → `normaliseGraphIds` → PLoT request
- **Naming convention**: CEE/PLoT use `observed_state` (snake_case); canvas nodes use `observedState` (camelCase)
- DraftChat.tsx maps `observed_state` → `observedState` when creating canvas nodes
- V2 adapter maps `observedState` → `observed_state` when building PLoT request

### Key adapter files

- `src/adapters/plot/v2/adapter.ts` — V2 request builder (transformNodeToV2, extractObservedState)
- `src/adapters/plot/v2/types.ts` — V2Node, V2ObservedState, V2RunRequest interfaces
- `src/adapters/cee/types.ts` — CEEAnalysisReady, CEEOptionV3 interfaces
- `src/canvas/components/DraftChat.tsx` — CEE response → canvas node mapping
- `src/utils/nodeIdNormalisation.ts` — ID normalisation (uses spread, preserves fields)

### Patterns

- `transformNodeToV2` uses a **blocklist** (V2_NODE_BLOCKLIST) to exclude RF internals while passing through all CEE fields
- `extractObservedState` **spreads** original observedState then overlays computed defaults (std, baseline only when missing)
- DraftChat uses destructure + spread: `const { id, kind, ..., ...rest } = n` to preserve unknown fields

## Commands

**This repo is pnpm-only** (`packageManager: pnpm` in package.json; the tracked lockfile is
`pnpm-lock.yaml`; CI uses `pnpm install --frozen-lockfile`). Never use npm or yarn for
installs or scripts — `package-lock.json` must never be created or committed.

```bash
pnpm run dev          # Start dev server (port 5173)
pnpm run build        # Production build
pnpm run lint         # ESLint
pnpm run typecheck    # THE typecheck gate — scripts/ci/typecheck-gate.sh
                      #   phase 1: every tracked .ts/.tsx is loaded by a project (derived from git ls-files)
                      #   phase 2: per-file error ratchet vs scripts/ci/typecheck-baseline.txt
                      #   accept intended drift: `bash scripts/ci/typecheck-gate.sh --update-baseline`
pnpm run typecheck:selftest  # Positive control: proves the gate actually goes RED (own CI job)
pnpm test             # Run tests (vitest run --reporter=verbose)
pnpm run test:full    # Full suite with increased memory (NODE_OPTIONS=--max-old-space-size=6144)
```

## Git & Deployment

- Always push to `staging`. Never push to `main` without explicit user confirmation.
- Run `git status` and `git diff --staged` before committing to verify only intended changes are staged.
- If there are uncommitted changes from previous sessions, flag them and get user approval before including.
- Actually execute every git command — do not present commands as a summary without running them.
- After push, verify it succeeded by checking the output.
- Never bundle unrelated uncommitted changes into a deployment commit.
- No simultaneous Claude Code sessions on this repository.

### Pre-push validation — two scripts, different scopes

- **`.git/hooks/pre-push`** (git hook, auto-runs on `git push`) delegates to `scripts/validate-prepush.sh`. This is the **fast gate** (~3 min): branch guard, typecheck, lint (changed files only), 9-file smoke suite, stale-.js detection, dependency audit with `@talchain/schemas` allowlist + vendored-tarball SHA manifest check. Blocks the push on failure. The smoke list is derived, not mirrored: a `SMOKE_FILES` entry naming a spec that no longer exists is a gate FAILURE, never a silent skip (this doc said "8-file" while the list named 9 — the gate had been running 8 of 9 since 2026-04-21).
- **`bash scripts/pre-push-validate.sh`** (manual, optional) is the **full gate** (~15 min): runs the same checks but replaces the smoke suite with the full ~6,284-test vitest run. Used only when you want the full suite locally. Not invoked automatically — CI covers the full suite via `.github/workflows/staging-full-tests.yml` (7 GB heap, dedicated runner).
- **`@talchain/schemas` file: dependency is allowlisted** deliberately (v5 A1 policy, commit `b6b1222a`). Both pre-push scripts pair the allowlist with a tarball SHA manifest check that fails on drift. Any OTHER `file:` reference fails either gate.

## Session Preamble

At the start of every session, before any other work:

```bash
# 1. Branch, recent history, and working tree state
git branch --show-current && git log --oneline -5 && git status

# 2. Check for stale .js files shadowing .ts/.tsx sources
find src -name '*.js' -o -name '*.jsx' | while read f; do
  for ext in .ts .tsx; do
    tsf="${f%.*}$ext"
    [ -f "$tsf" ] && echo "STALE: $f"
  done
done

# 3. Check for uncommitted changes or stash entries
git stash list
```

Report the output. Stale `.js` files cause silent shadowing bugs where Vite resolves the `.js` file instead of the `.ts` source. Flag unexpected uncommitted changes or stash entries before proceeding. Confirm the branch is correct for the task.

## Testing — Three-Tier Process

Testing uses a tiered approach to avoid crushing the local machine. The full suite
(~775 files, ~6,284 tests) takes ~15 min locally. Local heap is 6 GB (bumped from
4 GB in Brief 5.2 close-out — see `docs/ops/vitest-full-suite-oom-diagnosis.md` for
the diagnosis + fix options if 6 GB ever becomes insufficient). CI is the real
safety net — `.github/workflows/staging-full-tests.yml` runs the full suite with
a dedicated runner and 7 GB RAM.

### Tier 1: Smoke (after every code change)

Run **only** after making changes, before reporting the task as done.
Targets changed files and their direct dependents — fast and light.

```bash
pnpm run typecheck                              # ~60-90s, catches type errors
npx vitest run --changed --bail=1              # only tests affected by changes
```

If `--changed` finds no related tests, skip the vitest step — typecheck alone is sufficient.
Report: "Typecheck passed. N related tests passed." (or "No related tests for this change.")

### Tier 2: Pre-commit validation

Run before committing. Still lightweight — no full test suite.

```bash
pnpm run typecheck
pnpm run lint
```

### Tier 3: Full gate (before pushing to staging only)

Run **only** when the user explicitly says to push to staging.

```bash
git push origin staging
```

`git push` automatically invokes the **fast gate** (`.git/hooks/pre-push` →
`scripts/validate-prepush.sh`, ~3 min): typecheck, lint changed files, smoke suite,
stale-.js check, dep audit. The **full ~6,284-test suite runs in CI post-push**
via `staging-full-tests.yml` — don't re-run it locally unless explicitly asked.

If the user asks to run the full suite outside of a push, use ONE of:
```bash
pnpm run test:full                  # vitest full suite — 6 GB heap, --bail=1
bash scripts/pre-push-validate.sh  # full suite + typecheck + lint + dep audit
pnpm run build                      # production build (separate concern)
```

### Important rules

- **Never run `pnpm test` (full suite) after every code change** — it's wasteful and slow.
- **Never run typecheck + full tests in parallel** — doubles peak RAM.
- The manual full-suite script runs checks sequentially to stay within memory limits.
- Vitest teardown may emit `ERR_WORKER_OUT_OF_MEMORY` even when all tests pass; the
  pre-push-validate script recognises this pattern and treats it as a success when
  the summary reports zero failures. See `docs/ops/vitest-full-suite-oom-diagnosis.md`.
- CI (GitHub Actions) is the authoritative gate — it runs the full suite, E2E, coverage,
  bundle policy, and security scans. Local testing is a fast feedback loop, not a replacement.

## Debugging

- UI is a passthrough for display — it must not transform meaning (flip signs, default missing values, clamp ranges). If you see incorrect data displayed, the bug is upstream (PLoT or CEE), not in the UI.
- All semantic transforms are tagged with `UI-SEM-*` comments. Do not add untagged transforms — assign the next ID from the table below. See full inventory:

### Semantic Transform Inventory (UI-SEM)

| ID | Location | Description | Status |
|----|----------|-------------|--------|
| UI-SEM-001 | `src/adapters/plot/v2/adapter.ts:549` | Canvas weight+direction → signed mean (wire format) | Keep — format conversion (legitimate) |
| UI-SEM-002 | `src/adapters/plot/v2/adapter.ts:306` | Observed state default injection (std/baseline fallback) | Keep — adapter concern (legitimate) |
| UI-SEM-003 | `src/adapters/plot/v2/adapter.ts:308` | STD floor enforcement (prevents zero-variance crash) | Keep — adapter concern (legitimate) |
| UI-SEM-004 | `src/canvas/adapters/islRequestAdapter.ts:646` | Risk→goal sign heuristic (last-resort fallback) | Keep — adapter concern (legitimate) |
| UI-SEM-005 | `src/components/results/useResultsSectionData.ts:1034` | Robustness level derivation from stability thresholds (0.8/0.5/0.3) | Remove when PLoT provides level |
| UI-SEM-006 | `src/components/results/buildResultsVM.ts:78` | DecisionState thresholds (GAP 0.10, ROBUST 0.80, SENSITIVE 0.55) | Keep — VM-layer display (legitimate) |
| UI-SEM-007 | `src/components/results/buildResultsVM.ts:41` | Stability fabrication from categorical robustness level | Remove when PLoT guarantees numeric stability |
| UI-SEM-008 | `src/lib/format.ts:61` | Probability cap at 99% | Keep — display formatting (legitimate) |
| UI-SEM-009 | `src/canvas/components/DecisionSummary.tsx:239` | p15/p85 confidence band fabrication (interpolated from p10/p50/p90) | Remove — request from PLoT or delete |
| UI-SEM-010 | `src/types/constraints.ts:38` | Constraint confidence colour thresholds (HIGH≥0.70, LOW≥0.40) | Keep — display formatting (legitimate) |
| UI-SEM-011 | `src/canvas/hooks/useGraphReadiness.ts:323` | Default belief injection (0.8) for CEE coaching | Keep — pre-analysis default (low risk) |
| UI-SEM-012 | `src/components/results/useResultsSectionData.ts:1913` | Edge severity from switch_probability (>0.7 critical, >0.5 error) | Remove when PLoT provides severity |
| UI-SEM-013 | `src/components/results/useResultsSectionData.ts:1630` | Fragile edge filter threshold (0.15) | Remove when PLoT provides visibility gate |
| UI-SEM-014 | `src/components/results/DriversSection.tsx:259` | VOI evidence threshold (>0.05 shows hint) | Remove when PLoT provides visibility gate |
| UI-SEM-015 | `src/components/results/useResultsSectionData.ts:578` | Confidence tier score-based fallback (>=70 strong, >=40 fair) | Remove when PLoT provides tier thresholds |
| UI-SEM-016 | `src/adapters/plot/enrichment.ts:279` | Robustness label from numeric score (>=0.7 robust, >=0.4 moderate) | Remove when PLoT provides label |
| UI-SEM-017 | `src/adapters/plot/httpV1Adapter.ts:87` | Confidence level from numeric score (>=0.7 high, >=0.4 medium) | Remove when PLoT provides categorical level |
| UI-SEM-018 | `src/canvas/components/UnifiedStatusBadge.tsx:49` | Confidence score fabrication (high=0.8, medium=0.5, low=0.3) + status thresholds | Remove when PLoT provides numeric confidence |
| UI-SEM-019 | `src/components/results/useResultsSectionData.ts:537` | Readiness/confidence taxonomy mapping (varied PLoT labels → strong/fair/needs_work) | Remove when PLoT provides canonical tier enum |
| UI-SEM-020 | `src/canvas/hooks/useStagePill.ts` | Stage derivation from canvas state (no graph=frame, graph=ideate, complete=evaluate) | Remove when orchestrator provides envelope.stage_indicator |
| UI-SEM-021 | _`HeroSection.tsx` removed (288a2b74)_ | Suppress coaching copy containing "robust"/"ready to proceed" when robustness level is low/very_low | **Retired with the component** — the old results hero was deleted; the analysis-hero replacement is producer-gated (coaching copy is not threshold-derived). ID retained for history |
| UI-SEM-022 | `src/canvas/components/DraftChat.tsx:505` | Direction inference from signed weight when CEE omits effect_direction | Keep — defensive fallback (remove when CEE guarantees direction) |
| UI-SEM-023 | `src/canvas/components/DraftChat.tsx:519` | Weight magnitude clamped to [0, 2] range | Keep — prevents out-of-range values |
| UI-SEM-024 | `src/canvas/components/DraftChat.tsx:543` | Belief confidence clamped to [0, 1] | Keep — normalisation |
| UI-SEM-025 | `src/canvas/components/DraftChat.tsx:553` | belief_exists clamped to [0, 1] | Keep — normalisation |
| UI-SEM-026 | `src/adapters/cee/client.ts:255` | CEE edge weight clamped to [0, 1] | Keep — normalisation (CIL 0.2) |
| UI-SEM-027 | `src/adapters/cee/client.ts:261` | CEE edge belief clamped to [0, 1] | Keep — normalisation (CIL 0.2) |
| UI-SEM-028 | `src/adapters/cee/client.ts:307` | CEE belief_exists clamped to [0, 1] | Keep — normalisation (CIL 0.2) |
| UI-SEM-029 | `src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:121` | Edge weight/direction display defaults (0.5 / 'positive') | Keep — display-only fallback |
| UI-SEM-030 | `src/canvas/hooks/useGraphReadiness.ts:382` | Edge defaults for CEE coaching (weight 0.5, belief 0.8, direction 'positive') | Keep — pre-analysis defaults (same class as UI-SEM-011) |
| UI-SEM-031 | `src/adapters/plot/v2/adapter.ts:597` | Default exists_probability (0.8) for std computation | Keep — adapter concern (same class as UI-SEM-002) |
| UI-SEM-032 | `src/canvas/adapters/islRequestAdapter.ts:169` | Default exists_probability (0.8) for std computation — mirrors UI-SEM-031 | Keep — adapter concern |
| UI-SEM-033 | _removed_ — was `src/canvas/components/ModelTabBody.tsx` | Edge display defaults (weight 0.5, direction 'positive', belief 0.7) | **Retired** (ledger corrected 2026-07-14) — the display defaults are gone; ModelTabBody now derives edge direction from the sign of the mean (`mean >= 0 ? 'positive' : 'negative'`) and defaults weight to `null`, not 0.5. ID retained for history |
| UI-SEM-034 | `src/adapters/plot/v1/mapper.ts:207` | V1 adapter belief clamped to [0, 1] | Keep — normalisation |
| UI-SEM-035 | `src/canvas/conversation/useConversation.ts:1086` | Weight clamp to [-1,+1] for CEE signed mean | Keep — format conversion |
| UI-SEM-036 | `src/canvas/adapters/ceeSynthesisAdapter.ts:75` | Robustness label-to-score default 0.5 for CEE synthesis | Keep — contextual, not inference |
| UI-SEM-037 | `src/canvas/adapters/islRobustnessAdapter.ts:171` | Default current_value/flip_threshold/sensitivity = 0.5 | Keep — display-only fallback |
| UI-SEM-038 | `src/canvas/utils/applyDraftResult.ts:74` | Duplicate of UI-SEM-023/024/025 on alternate ingestion path | Keep — normalisation |
| UI-SEM-039 | `src/components/results/useResultsSectionData.ts:538` | Driver semantic label thresholds (0.50 strong, 0.20 moderate) | Remove when PLoT provides semantic labels per driver |
| UI-SEM-040 | `src/components/results/useResultsSectionData.ts:1601` | Dominance detection heuristic (>0.5 influence AND ratio >2:1) | Remove when PLoT provides dominant_factor in all responses |
| UI-SEM-041 | `src/lib/stability.ts` (`getStabilityClassification`) | Stability UI label thresholds (0.85/0.70/0.55) | Keep — display formatting. **CONSOLIDATED (ledger corrected 2026-07-14 — was mislabelled "retired")**: when HeroSection was removed the numeric→categorical stability classification was consolidated (with 005/044) into the shared `getStabilityClassification`; it is LIVE, consumed by GoalNode's stability bar |
| UI-SEM-042 | _`HeroSection.tsx` removed (288a2b74)_ | Fragility ratio threshold (>0.7) for trust reason | **Retired with the component** — analysis-hero consumes a producer `trustLine` (null on the live path, `buildHeroModel.ts`), not a threshold-derived reason. ID retained for history |
| UI-SEM-043 | _`HeroSection.tsx` removed (288a2b74)_ | Evidence quality threshold (<0.5) for trust reason | **Retired with the component** — analysis-hero consumes a producer `trustLine` (null on the live path), not a threshold-derived reason. ID retained for history |
| UI-SEM-044 | `src/lib/stability.ts` (`getStabilityClassification` → `borderClass`) | Border colour classification from stability | Keep — display formatting. **CONSOLIDATED (ledger corrected 2026-07-14 — was mislabelled "retired")**: consolidated (with 005/041) into `getStabilityClassification`; the `borderClass` it returns is LIVE, consumed by GoalNode's border override |
| UI-SEM-045 | `src/components/results/DriversSection.tsx` (rank-flip warning) | Rank-flip warning visibility gate (`rankFlipRate >= 0.15`) | **DORMANT** — the branch is behind `SHOW_FRAGILITY_IN_DRIVER_SECTION = false` (DriversSection top), so the 0.15 gate is NOT currently reachable in the UI. Remove when PLoT provides a visibility gate. (Ledger corrected 2026-07-14 — threshold was 0.3, is now 0.15; source re-tagged; dormancy noted per review round 2) |
| UI-SEM-046 | `src/components/results/DriversSection.tsx` (`tooltipElasticityCopy`) | Elasticity display scaling (×10, floor 1) | Remove when PLoT provides shift percentage. (Source re-tagged 2026-07-14) |
| UI-SEM-047 | `src/components/results/DriversSection.tsx:356` | Confidence clamped to [0, 1] | Keep — normalisation |
| UI-SEM-049 | `src/canvas/components/ModelTabBody.tsx` | VOI fallback: value_of_information * 100 as pp when evpi_percentage_points absent | Remove when PLoT guarantees evpi_percentage_points |
| UI-SEM-050 | `src/components/results/useResultsSectionData.ts` | Leading-option downside flag — true when leading option's `outcome.p10 < 0`, drives one qualifying sentence on the leader card (display-only, never affects ranking or forwarded values) | Keep — display formatting (legitimate) |
| UI-SEM-051 | `src/canvas/components/pre-analysis-v3/constants.ts` | Pre-analysis v3 bar state colour thresholds (warning <0.40, success >=0.75) | Keep — display formatting (legitimate) |
| UI-SEM-052 | `src/canvas/components/pre-analysis-v3/constants.ts` | Pre-analysis v3 bar fill denominators (options/risks saturate at 3; frame thirds; estimates degree-fallback base weight 1) | Keep — display formatting (legitimate) |
| UI-SEM-053 | `src/canvas/components/pre-analysis-v3/constants.ts` | Pre-analysis v3 gauge segment quantisation (continuous fill → lit-of-N discrete segments: round(fill·N), clamp [1,N] for positive fill, 0 when empty) | Keep — display formatting (legitimate) |
| UI-SEM-054 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero outcome-axis layout domain (min/max over existing p10/p90/centres only; span floored to OUTCOME_CLOSE_RATIO 0.15 × largest coordinate magnitude and re-centred so a spread tiny RELATIVE to the values does not zoom the axis and amplify sub-resolution noise; then 5% pad, unit pad on all-zero span) — positions bars only, never displayed as data; goal threshold excluded so it cannot compress the comparison chart | Keep — display formatting (legitimate) |
| UI-SEM-055 | `src/components/results/analysis-hero/HeroOptionRow.tsx` | Analysis-hero track position clamp to [0,100]% of the track for bars/dots (layout only; readouts always show unclamped source values) | Keep — display formatting (legitimate) |
| UI-SEM-056 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero constraint-presence copy switch (goal-and-limits vs goal-alone wording; "and limits" only when every goal-bearing option carries constraint analysis) | Keep — display formatting (legitimate) |
| UI-SEM-057 | `src/components/results/utils/displayFloors.ts` | Sub-1% goal display floor (shared constant): "< 1%" readouts (hero + OptionCards "likely to reach target"), the hero's goal-fit leader-claim gate, and the no-option-on-track headline switch | Keep — display honesty (legitimate) |
| UI-SEM-058 | `src/canvas/hooks/useV2Run.ts`, `src/adapters/plot/httpV1Adapter.ts` (extractGoalThreshold) | Raw→normalised goal-threshold conversion for PLoT request (raw/cap; omit when unprovable) | Keep — format conversion (same class as UI-SEM-001) |
| UI-SEM-059 | `src/components/results/RangeVisualization.tsx` | formatThreshold legacy percent auto-detect (\|v\| ≤ 2 → ×100) for callers not asserting isNormalised | Remove when all callers pass isNormalised explicitly |
| UI-SEM-060 | `src/lib/decisionVerdict.ts` (the verdict), `src/components/results/analysis-hero/buildHeroModel.ts` (the hero band) | **RESIDUAL FALLBACK DELETED 2026-07-26 (ROADMAP 1.223, gate G-CEE-1) — this row is now a prohibition, not a threshold.** The leader claim is the PRODUCER's: `deriveDecisionVerdict` accepts `robustness.near_tie` or `decision_brief.headline_banded` (each identity-gated to the win-probability rank-1 option) and NOTHING ELSE; `buildHeroModel` sets its band only from that verdict or from the same producer band. The old UI banding (>=0.65 "most likely to be strongest overall"; >=0.50 or win-gap >= 0.10 "slightly ahead"; else "No option is clearly ahead.") is GONE, along with `LEADER_GAP_THRESHOLD` and the `'win_probability'` member of `DecisionVerdict.source` (removed from the union so re-introducing a UI-derived leader is a type error). **Why it could not stay as a fallback:** CEE #711 made producer SILENCE meaningful — on a withheld constraint verdict CEE drops `decision_brief.headline`/`.headline_banded` and nulls `leading_option_id`, while the per-option win probabilities keep riding the wire because the DATA is not withheld, only the CLAIM. The fallback read exactly those numbers and rebuilt exactly that claim (live render probe: gap 0.346 => `hasLeadingOption: true`), so nine leader surfaces rendered beside CEE's own "no option can be put forward yet". A fallback does not degrade gracefully once silence carries information — it OVERWRITES the message. **Absent claim => `separation: 'unknown'` => silence, never `'tied'` (which would license the denial "No option is clearly ahead." — a second unearned claim).** Identity (`leaderId`) and `gapPp` still flow; only the ENTITLEMENT is withheld. Raw probabilities, charts and rows are untouched — data is not a claim | **Keep — this is the contract.** Any future "just band it ourselves when the producer is quiet" is the defect returning |
| UI-SEM-064 | `src/canvas/utils/interventionDisplay.ts` | Shared intervention-change formatter: exact-equality no-change gate (epsilon 1e-9), count-unit singularisation, qualitative-tier→percentage rendering | Keep — display formatting (legitimate) |
| UI-SEM-065 | `src/components/results/ResultsBody.tsx` | Degraded-run derivation (analysisStatus 'partial' OR GRAPH_TOO_LARGE/blocker critiques) feeding stress-test copy | Remove when PLoT provides a canonical degraded/approximate flag |
| UI-SEM-066 | `src/canvas/components/ValidationPanel.tsx` | Blocked-vs-approximate heading suffix from results.status ('blocks analysis' only when no completed results) | Remove when the engine's critique carries a blocked/approximate discriminator |
| UI-SEM-067 | `src/canvas/nodes/OptionNode.tsx` | Behind-reason display gates: leader tolerance (win within 1e-4 of max) + identical-reason suppression across losers | Remove when PLoT/CEE provide per-option "behind" explanations |
| UI-SEM-068 | `src/components/results/StressTestSection.tsx` | Robustness didn't-run mapping (robustnessStatus !== 'computed' → "fragility hasn't been checked") | Remove when PLoT provides a canonical robustness status enum |
| UI-SEM-069 | `src/components/results/useResultsSectionData.ts` | Critique severity-taxonomy bridge: ingest semantic_severity 'WARNING' advisories (IMPROVEMENT-severity) into uncertainties | Remove when PLoT unifies the critique severity taxonomy |
| UI-SEM-070 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero readout-tie subline gate: when the top-two options render an IDENTICAL expected-outcome readout string (exact equality, the "what the user sees" signal — the reported run showed "100" on all four), the subline is the neutral "The top options are close on expected outcome." in both the aligned and diverged branches, never "strongest/highest". Stricter than UI-SEM-060's 15% closeness (which only names a runner-up in the win-banded case) so an 8–15% gap that renders as distinct numbers still reads as a genuine lead; headline is unchanged (stays the panel-agreeing leader claim) | Remove when PLoT provides a leader-confidence / close-call signal |
| UI-SEM-071 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero null-target goal-claim suppression: goal-fit display gates on the USER success target (`goalThreshold`), never on producer value presence — with no user target the request omits goal_threshold, ISL synthesizes auto_goal_threshold and the selector fallback adopts probability_of_joint_goal as goalProbability, so every row's goal slot (bars, readouts, goalFit detail), the goal lens, the goal-fit/on-track headlines and the goal leader ring are suppressed; the goal lens shows the needs-target state and the default lens falls back to Likely outcome. Suppression only — no value transformed | Keep — display honesty (legitimate) |
| UI-SEM-072 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero goal-fit crown gate: the "best fits your goal" headline + goal-lens leader ring crown the goalProbability ARGMAX (selection of existing producer values — never the recommendation/win leader re-crowned onto the goal view; live staging crowned a 4% fit over 7%/6%), and ONLY when a user target exists (UI-SEM-071), EVERY row carries its own goal probability, the max is uniquely held, and it clears the UI-SEM-057 sub-1% floor; otherwise no crown (falls through to the banded analysis-leader headline, no ring — no crown rather than a wrong crown). The tension subline compares the actually-headlined row against the outcome leader | Keep — display honesty (legitimate) |
| UI-SEM-073 | `src/components/results/utils/uncertaintyCalibration.ts` | Sci-4B verbal-uncertainty-calibration tier downgrade: when the wire robustness band is "high" but the headline option's outcome interval straddles zero (`p10 < 0 < p90` — the outcome's direction is still uncertain even though edge-robustness is high), the "fairly confident" framing downgrades one tier to the "meaningful uncertainty" framing. Classification of existing wire values only (same class as UI-SEM-050's p10<0 downside flag) — no numbers fabricated, and the function returns null (renders nothing) when no robustness signal is present at all | Keep — display honesty (legitimate) |
| UI-SEM-081 | `src/canvas/blueprints/loadTemplateBlueprint.ts` | Template-blueprint mapping defaults: node label falls back to node id, missing node position falls back to the shared grid layout (`defaultGridPosition`), missing edge id generated from `from`-`to` | Keep — adapter concern (same class as UI-SEM-002); extracted verbatim from TemplatesPanel.handleInsert |
| UI-SEM-074 | `src/components/results/analysis-hero/buildHeroModel.ts` | Flip-risk direction wording from producer values (flip_value < current_value → "falls below", > → "rises above", equality → neutral "crosses" — no direction claim when not honestly determinable; upstream missing-current_value defaults to 0, so a 0-threshold equality also stays neutral) | Remove when PLoT provides direction/consequence wording per flip threshold |
| UI-SEM-075 | `src/components/results/strengthen/buildRecommendations.ts` | Strengthen list flood control — display gating only: (a) phase-3 guidance promotion capped at the producer's own top-4 ranking (MAX_PHASE3_PROMOTED) so a verbose guidance payload cannot flood the panel; un-promoted items still render on their own guidance surfaces; (b) recommendations deduplicated by normalised title (keep the highest-priority instance) so the panel never shows two rows with identical titles | Remove when CEE ships a canonical per-surface promotion budget / deduplicated strengthen feed |
| UI-SEM-076 | `src/components/results/strengthen/StrengthenContainer.tsx` (adaptivePriorityFromStage) | Producer stage → strengthen adaptive-priority taxonomy bridge: orchestrator stage_indicator (frame→clarify, ideate→broaden, evaluate→evaluate, decide→commit, optimise→none) floats matching-helpType recommendations to the top of the engine ordering — ordering only, never a gate, null stage leaves the deterministic ladder untouched | Remove when CEE ships a canonical strengthen-priority signal on the wire |
| UI-SEM-077 | `src/components/results/decision-overview/DecisionOverviewCard.tsx` | Decision-classification pill inference: no producer classification contract exists, so the only populated pill is horizon (decision-node brief timeframe shown verbatim); stakes, reversibility and risk appetite fail closed to explicit "not set" pills — values never fabricated | Remove when CEE provides decision_classification {stakes, reversibility, horizon, risk} |
| UI-SEM-078 | `src/components/results/decision-overview/DecisionOverviewCard.tsx` | Framing-question interrogative derivation (deriveFramingQuestion): prefer genuinely interrogative guidance text (title then detail ending "?"), then detail prose, else compose "What would it take to {decapitalised title}?" — a bare imperative chip label is never shown as "Olumi's framing question" | Remove when CEE provides an explicit framing_question field |
| UI-SEM-079 | `src/components/results/decision-overview/DecisionOverviewCard.tsx` | Framing-quality derivation for the brief bar: blocker-severity engine critique (graphHealth, same source as UI-SEM-065) → blocked (danger, "resolve before relying on the read"); producer-ready with goalThreshold null → thin (warning, note names ONLY the missing success measure, never the fixture's broader claim); precedence unassessed > blocked > needs_input > thin > ready. Dimension-chip notes are honest store reads (success-target presence/format, option count, structured-constraint count, brief-text presence) — no quality claims | Remove when CEE/PLoT provide a producer framing_quality signal |
| UI-SEM-080 | `src/components/results/analysis-hero/buildHeroModel.ts` (selection), `src/components/results/analysis-hero/HeroEvidenceDisclosure.tsx` (barPct) | Evidence-disclosure magnitude bars: bar width % from an existing 0-1 producer-backed fraction — drivers use the SAME displayed influence metric DriversSection renders (displayInfluence ?? influenceScore ?? normalisedInfluence, Codex R3-B1 policy), flip rows use fragileEdgeInfo.switchProbability joined by node id; fraction×100 clamped [0,100], layout only (same class as UI-SEM-055 — never displayed as data, never fed back into ranking); absent value → no bar | Keep — display formatting (legitimate) |
| UI-SEM-081 | `src/canvas/hooks/useV2Run.ts` (capForUnit) | Unit-derived goal-threshold cap: a USER-stated "%" unit (Define-success picker / saved success measure) is a definitional cap of 100 — consulted only as last resort after the producer/node cap chain (UI-SEM-058); all other units derive no cap (fail-closed omission stands). Unlocks V-P0-1: live drafts carry no producer/node scale, so every %-target was silently omitted from the wire | Keep — format conversion from explicit user input (same class as UI-SEM-058); narrow when the producer guarantees goal_threshold_cap |
| UI-SEM-082 | `src/canvas/nodes/GoalNode.tsx`, `src/canvas/nodes/OptionNode.tsx` | Canvas goal achievement-probability user-target gate (Paul ruled; extends UI-SEM-071 doctrine to the canvas): the GoalNode "N% chance of reaching target" line + its modelled-basis caveat + its low-probability "Target may be ambitious" guidance (gate `hasThreshold` — node `success_threshold`/`goal_threshold_raw`), and the OptionNode "< N% chance of target" warning (gate store `goalThreshold != null` — the same predicate its panel twin OptionCards uses via `hasGoalThreshold`), all gate on the USER target being set, never on producer value presence. The producer synthesizes an auto_goal_threshold and returns a goal/joint probability even with no user target (UI-SEM-071 class), so without the gate the GoalNode would crown a target the user never set AND co-render it with the "Set a target to see your chances" invitation (now mutually exclusive by construction), and the adjacent OptionNode would contradict the fixed GoalNode. Suppression only — no value transformed. Deliberately NOT gated: OutcomeNode's "Achievement:" diagnostic (non-goal node, no target concept, no co-render). Latent/inert (not live, left as-is — do not gate dead code): the legacy `NodeInspector` is dead (`InspectorModal` hardcodes `USE_INSPECTOR_V2=true` → live inspector is `GoalPanel`); `DecisionSummary` "N% chance of success/reaching" has zero JSX mounts (superseded by the analysis-hero / RecommendationCard family — never rendered); `GoalPanel`'s Impact-group probability reads top-level `report.probability_of_goal`/`probability_of_joint_goal` which the V2/V5 mappers never populate (its "Your input" line is already gated). Complete goal-fit-surface manifest verified — OptionCards' "likely to reach target" is the already-gated live panel twin (`hasGoalThreshold`) | Keep — display honesty (legitimate) |
| UI-SEM-083 | `src/canvas/conversation/draftBiasSignalBlocks.ts` | Draft bias-signal alias-equivalence dedupe: identical (canonical bias title, resolved target node id) signals collapse before the display cap — alias wire codes (anchoring/anchoring_bias) are judged the same bias so a producer duplicate cannot displace a distinct third signal; first occurrence wins | Keep — display-side equivalence judgement (no value transformed); remove if CEE guarantees deduplicated bias_signals |
| UI-SEM-084 | `src/canvas/conversation/draftBiasSignalBlocks.ts` | Draft bias-signal display budget (DRAFT_BIAS_SIGNAL_CARD_CAP = 2, ratified): at most two bias-signal cards per draft turn; third-and-later grounded signals are dropped from the conversation surface (they still ride the store for other surfaces) | Keep — display budget (legitimate); remove when CEE ships a per-surface bias budget |
| UI-SEM-085 | `src/v5/extractPhase3FromV5Response.ts` (deriveGuidance — the single wire→internal mapping site), `src/canvas/stores/guidanceStore.ts` (compareGuidanceDisplayOrder — the single display-order doctrine), consumed in `src/components/results/strengthen/buildRecommendations.ts` | **NARROWED (0.19.0, producer half LIVE + consumed):** the trigger has FIRED for `category` + `priority` + `priority_rank` — CEE emits all three on every guidance block (wire-verified by CEE's `cee-egress-wire-surface-pin.test.ts`), the 0.19.0 schema is at THIS repo's own pin (`vendor/talchain-schemas-0.19.0.tgz`), and the UI now consumes each on its contract terms: `priorityRank` ← `priority_rank` VERBATIM (ascending ordinal, lower = first, UNBOUNDED — the historic `100 − rank` inversion clamped every rank ≥ 100 to one tie and collapsed the coaching band 100–199; presence = producer-ranked), `priority` ← `priority` VERBATIM (coarse 0–100 urgency, higher = more urgent, band-granular ties normal — budget/filter/style only, NEVER display order), `category` ← the four-value class verbatim. All ordering surfaces (selectTopItem, GuidanceStrip, DecisionOverviewCard, inspector sections, the Strengthen phase-3 band) go through `compareGuidanceDisplayOrder` — one convention in the pipe, no inversions anywhere. **STILL UI-AUTHORED (the residual inventions):** (1) `signal_code`→`block.type` — schemas-blocked: `signal_code` verified ABSENT from the published 0.19.0 tarball (0 occurrences, whole package), on the orchestrator's queue; (2) `source`→`'analysis'` default; (3) fail-closed defaults for GENUINE absence only — `category`→`'should_fix'`, `priority`→`50` (disclosed via `priorityIsProducerSupplied`, which now means exactly "wire `priority` was emitted") on pre-0.19.0/malformed blocks, and rank-less blocks (exercise blocks carry no `priority_rank` BY CONTRACT) stay demoted to the `phase3Unranked` band with the "not ranked — shown in the order received" label — demotion + disclosure, never a replacement rank | Residual: remove the `signal_code`→`block.type` fallback when schemas ships `signal_code` AND it is verified at the UI's own `@talchain/schemas` pin (a new field is silently dropped by a consumer on an older pin, indistinguishable from CEE never sending it); the fail-closed defaults stay as long as pre-0.19.0/rank-less blocks can arrive |
| UI-SEM-086 | `src/canvas/components/pre-analysis-v3/hero/parseSuccessTarget.ts` (used by HeroSection commitSuccess), unit capture in `src/canvas/store.ts` setGoalThresholdAndUpdateNode | Success-target extraction from the Hero Success field's free text: bare numeric tokens parse with currency symbol + k/m/bn multiplier + % ("£500k" → 500000, unit '£'); in prose, timeframe numbers (followed by day/week/month/quarter/year) are excluded and a single currency/percent-marked amount wins over bare numbers; ambiguity (two candidates) fails closed to the format hint. Replaces the untagged digit-strip parse that concatenated all digits ("Reach £500k … within 12 months" → 50012 — dress-rehearsal 2026-07-20: "Target: 50,012" on the goal node, "5,001,200% likelihood" in the Model tab). Captured unit is written to the goal node's goal_threshold_unit so GoalNode/Model-tab/hero render the raw value honestly | Keep — input parsing (fail-closed); revisit if CEE ever returns a structured echo of the constraint it encoded |
| UI-SEM-087 | `src/canvas/ui/inspector-v2/panels/GoalPanel.tsx` (`constraintsInert` gate), copy in `src/canvas/ui/inspector-v2/inspectorStrings.ts` (`GOAL_CONSTRAINT_COPY.guestConstraintsNotInAnalysis`), predicate in `src/lib/persistenceActive.ts` (`isPersistenceActive`) | Constraint display-honesty gate (same class as UI-SEM-071/082 — gate on truth, never fabricate). **RE-SCOPED per the live wire-probe (parallel-briefs/S-AUDIT-2026-07-20/probe-s1-s2-claims.md), which refuted the original "constraints reach nothing" premise in BOTH directions:** an authenticated user's panel constraints persist (gated write-through → scenarios.graph → CEE run_analysis reads its own server graph), AND a GUEST's CHAT-entered constraints reach analysis too (CEE add_constraint handler persists server-side regardless of auth — wire-proven per-option `constraint_probabilities`/`constraint_margins` returned). The ONLY dead leg is the GUEST GoalPanel → client-RPC persistence hop: guest writes are scenario-id/RLS-gated and silently swallowed, so a guest's PANEL-entered constraint never reaches the server graph. So the honest condition is exactly "this session's writes don't persist" — the canonical `isPersistenceActive(authenticated, user)` predicate (shared with useScenario + loginDraftImport; NO longer the run path). The label shows ONLY for guest/unauthenticated sessions, ONLY pre-analysis (entry disabled in results mode; post-analysis probabilities would contradict it), ONLY on the GoalPanel entry/display surfaces; authenticated users and the guest chat surface see NO label, and the copy names chat as the working alternative. One note shown at a time (display-surface footer when constraints exist, else entry-surface note — never stacked) | Remove when the guest GoalPanel→server-graph persistence hop lands (or a producer echo confirms the panel constraints were used) |
| UI-SEM-088 | `src/adapters/plot/constraintTrust.ts` — SPLIT into two independently-controlled constants: `PLOT_JOINT_HEADLINE_SUSPECT` (seam 1, gated at `src/components/results/utils/selectGoalProbability.ts`) + `PLOT_PER_OPTION_CONSTRAINTS_SUSPECT` (seam 2, gated at `src/adapters/plot/v2/responseMapper.ts`) | **Temporary producer-defect honesty gate (2026-07-20), NOW SPLIT (2026-07-21).** Origin: PLoT's constraint normalisation was broken when a constrained node lacked explicit scale (ROADMAP 2.83, a PLoT P0): the constraint probabilities could INVERT (a VIOLATED cap → `prob_satisfied`/`probability_of_joint_goal` ≈ 1.0) and failure margins ran +25–43% off; the bite was the common CEE-drafted case (no explicit scale). #410 shipped ONE blanket constant suppressing both seams. **The two seams have now diverged, so the single constant is split — one per seam, each independently flippable, deliberately NO client-side bite-condition detection (replicating a producer predicate on the consumer is the hand-maintained-mirror drift class).** **SEAM 1 — RESTORED (`PLOT_JOINT_HEADLINE_SUSPECT = false`):** A3's PLoT constraint-normalisation fix is DEPLOYED-AND-VERIFIED (2026-07-16, PLoT staging ea106565 == /health, `acceptance-evidence/a3-verify-2026-07-16/constraint-norm-split/POSTFIX-VERIFICATION.md` — on a violated cap `probability_of_joint_goal` flips 1→0 IN LOCKSTEP with the standalone constraint prob, i.e. correct at source). So `selectGoalProbability` again PREFERS the joint figure when constraints exist and takes the auto-derived joint fallback — the full flow covering OptionCards goal readout, analysis-hero goalFit, OptionNode "chance of target" badge, useResultsSectionData. **SEAM 2 — STILL GATED (`PLOT_PER_OPTION_CONSTRAINTS_SUSPECT = true`):** NOT cleared by A3's fix — blocked on a separate UI-side mapper-seam defect (our read shape ≠ what PLoT emits on V5; #410's seam-2 positive control was a synthetic fixture, and selectGoalProbability prefers the unconstrained number when both fields are present). The V2 responseMapper still omits per-option `constraint_analysis`, so TargetProbabilityBars, OptionCards' joint badge + "Meets/May miss all targets" verdict, the hero "and limits" wording (UI-SEM-056 reverts to goal-alone automatically) and GoalNode/OutcomeNode achievement (useNodeDisplayMetadata) all take their absent-constraint branch. Presence-only copy (that a target/constraint EXISTS, no number) is untouched. The positive-control specs pin the current split (seam-1 restored / seam-2 gated) and mutation-prove the two are independent: flip seam-1 true → headline re-suppressed; flip seam-2 false → per-option restored | Seam 1 **done** (restored). **Remove seam 2** when the mapper-seam defect is fixed AND A3's `scale_provenance`/`constraints_decision_grade` markers are deployed-and-verified; then delete both constants + inline the branches |
| UI-SEM-089 | `src/canvas/nodes/OutcomeNode.tsx`, `src/canvas/nodes/RiskNode.tsx` (Layer-1 bridge-strength readout) | **Display honesty — assumed input never presented as computed output.** The Layer-1 percentage on Outcome/Risk nodes is the STATIC graph edge weight (`bridgeStrengthPct` = round(\|signed-mean\|·100)) toward the goal — an assumed input, never an engine-computed contribution. Previously the label flipped from "assumed strength" (pre-analysis) to "of your goal" (OutcomeNode) / "goal drag" (RiskNode) the instant `results.status` became `'complete'`, so the SAME un-computed value read as a computed goal contribution once analysis ran (live-confirmed: "65% assumed strength" → "65% of your goal"). Fix: the readout keeps the honest "assumed strength" wording in ALL states; the separate `contributionPct` (weight·100) field that fed the post-analysis relabel was removed. Suppression/wording only — no value transformed | Remove when a producer supplies a typed per-node goal-attribution field |
| UI-SEM-090 | `src/canvas/conversation/AnswerBody.tsx` (`MAX_BULLETS`) | Answer-shape bullet clamp (F1): CEE's answer-shape sidecar — CONFIRMED contract, top-level `_answer_shape` on the V5 response body, `{ headline: one non-blank sentence, bullets: string[] (max 3, may be empty), detail: string (non-blank, the full explanation) }` — renders as a concise headline + at most 3 bullets, with the long tail behind a "Show more". `AnswerBody` slices the producer's `bullets` array to `MAX_BULLETS = 3` at the display boundary — display formatting only, never mutates the source, never reorders, never fabricates a bullet (same class as the SuggestedChips 0-3 cap). The structured view REPLACES the free-text body only when the sidecar is well-formed (non-blank headline AND non-blank detail — detail-presence is the no-content-loss gate; bullets may be empty); absent/malformed → free-text render unchanged. No flag: auto-lights-up when the sidecar lands on the wire (CEE lane deleting its flag + pinning the contract is in flight). `_answer_shape` is CEE-internal (NOT in @talchain/schemas); the UI parser demotes it into `response[__additive__]` exactly like `_reasoning`, and `extractAnswerShapeSidecar` (answerShape.ts) reads it there (plus a formal top-level field for future schema promotion), fail-closed | Remove the clamp when CEE guarantees `bullets` is capped on the wire; drop the additive-sidecar read if `_answer_shape` is ever promoted to a strict schema field |
| UI-SEM-091 | `src/canvas/utils/canRunAnalysis.ts` (readiness gate), `src/canvas/stores/readinessStore.ts` (normaliser forward), `src/canvas/hooks/useGraphReadiness.ts` (`GraphReadiness.scaffold_plan` type), `src/canvas/components/pre-analysis-v3/selectors/computeLadder.ts` + `hooks/usePreAnalysisModel.ts` (footer/ladder disclosure) | Runnable-via-scaffold derivation (CEE #612): CEE rides `scaffold_plan: { will_scaffold_options: boolean; option_count? }` on the graph-readiness response (option_count present only when will_scaffold_options). The run gate becomes `allowed = readiness.can_run_analysis \|\| scaffold_plan.will_scaffold_options === true` — when CEE will draft the remaining options the panel is RUNNABLE despite can_run_analysis being false, because the run triggers that draft. The pre-analysis footer + ladder disclose it ("Olumi will draft the remaining {N} options") rather than the not-ready copy, so panel and gate never contradict. Fail-safe: scaffold_plan absent/undefined ⇒ every term is false and behaviour is byte-identical to pre-scaffold (allowed = can_run_analysis); the 404/429 local-fallback readiness carries no scaffold_plan, so it is unaffected. `scaffold_plan` is a CEE endpoint-response shape (NOT @talchain/schemas), typed UI-side and forwarded explicitly by the readiness normaliser (an unforwarded field would be silently dropped — the schema-skew hazard) | Remove the OR + disclosure when CEE folds scaffold-intent into can_run_analysis itself (readiness reporting runnable when it will scaffold) |
| UI-SEM-092 | `src/canvas/ui/inspector-v2/panels/RiskPanel.tsx` (`handleProbabilitySave`) | Risk likelihood percentage input → canonical 0-1 store value (P1.7): the RiskPanel likelihood control edits a percentage (0–100), stored as `parsed / 100` on the canonical `probability` scale (`RiskNodeDataSchema` = `z.number().min(0).max(1)`); the display side multiplies the 0-1 value back by 100 for the readout. `setProbability` clamps the result to [0,1]. Pure percentage↔decimal format conversion (same class as UI-SEM-001/UI-SEM-058) — no new scale invented, no meaning altered | Keep — format conversion (legitimate) |
| UI-SEM-093 | `src/utils/unitClassifier.ts` (`PERCENT_UNIT_SPELLINGS`) | Percent-unit WORD recognition (U2): CEE emits `goal_threshold_unit: 'percent'` where the rest of the estate uses the glyph `'%'`, so `classifyUnit` — which already carried a `'percent'` member in its `UnitClass` union — now matches `'%' | 'percent' | 'percentage'` case- and whitespace-insensitively, canonicalising to `'%'`. Mostly formatting ("20 percent" -> "20%"), BUT it also unlocks an existing x100 SCALE in four consumers (`labelUtils.formatInterventionValue` / `formatObservedValueWithUnit`, `formatFactorDisplayValue`, `FactorNode` prior-range), where a normalised 0-1 value with a percent unit converts to percentage points — the behaviour those branches already document in prose and could not reach while the classifier matched the glyph only. Declared BECAUSE of that scale, not the suffix. Retires FIVE untagged local copies of the same recogniser (`computeSuccessState.ts`, `useResultsSectionData.ts`, `GoalNode.tsx`, `NodeInspector.tsx`, `ComparisonCanvasLayout.tsx`) plus a sixth in `v5GraphPatchDescription.ts` that had drifted (it never learned `'percentage'`, so a CEE `unit: 'percentage'` rendered "20%" on five surfaces and "20 percentage" in the graph-patch receipt). Guarded by `src/utils/__tests__/percentWordSingleSource.spec.ts`, incl. negative controls pinning `'percentile'` / `'percentage points'` / `'per cent'` OUT, and a filesystem-derived drift alarm that fails if a surface reintroduces a local `'percentage'` literal in code | REMOVE when CEE/PLoT emit ONE spelling of the percent unit. The upstream fix is the correct one; this is the interim, and it is the only tagged reader |

- Check for stale `.js` files co-located with `.ts`/`.tsx` source files in `src/` when debugging unexpected behaviour.
- This is a React app — check for stale component state, missing dependency arrays in hooks, and incorrect memoisation when debugging rendering issues.

### Data flow tracing (mandatory before any fix)

Before implementing any bug fix or feature that touches data flowing between components or services:

1. Where does the data originate? (API response? Local state? URL params? PLoT SSE stream?)
2. List every transform/adapter layer it passes through (with file paths)
3. Where is it consumed in the UI?
4. Are there alternate code paths? (loading states, error states, empty states)

Only after the trace is documented, implement fixes at ALL affected layers.

## Code Review Analysis

When asked to address code review feedback:

1. Read ALL feedback items first before making any changes
2. For each item, determine independently:
   - Is the feedback valid and does it require a code change?
   - Is it already handled by existing code?
   - Is it incorrect or based on a misunderstanding of the architecture?
3. State your reasoning for each determination before making changes
4. Do not make changes just to appease reviewers if the existing code is correct
5. Group changes by affected file to minimise unnecessary edits

## Task Completion Checklist

Before reporting ANY task as complete, run the **Tier 1 smoke checks** (not the full suite):

```bash
git branch --show-current                      # Correct branch?
git status                                     # Clean state?
pnpm run typecheck                              # TypeScript compiles?
npx vitest run --changed --bail=1              # Related tests pass?
```

If typecheck or related tests fail, fix before reporting completion.
Do NOT run `pnpm test` (full suite) or `pnpm run build` here — the fast pre-push gate
runs typecheck + lint + smoke tests at push time, and CI runs the full suite + build
post-push. See "Testing — Three-Tier Process" above.
