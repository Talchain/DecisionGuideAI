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

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc -p tsconfig.ci.json --noEmit)
npm test             # Run tests (vitest run --reporter=verbose)
npm run test:full    # Full suite with increased memory (NODE_OPTIONS=--max-old-space-size=6144)
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

- **`.git/hooks/pre-push`** (git hook, auto-runs on `git push`) delegates to `scripts/validate-prepush.sh`. This is the **fast gate** (~3 min): branch guard, typecheck, lint (changed files only), 8-file smoke suite, stale-.js detection, dependency audit with `@talchain/schemas` allowlist + vendored-tarball SHA manifest check. Blocks the push on failure.
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
npm run typecheck                              # ~60-90s, catches type errors
npx vitest run --changed --bail=1              # only tests affected by changes
```

If `--changed` finds no related tests, skip the vitest step — typecheck alone is sufficient.
Report: "Typecheck passed. N related tests passed." (or "No related tests for this change.")

### Tier 2: Pre-commit validation

Run before committing. Still lightweight — no full test suite.

```bash
npm run typecheck
npm run lint
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
npm run test:full                  # vitest full suite — 6 GB heap, --bail=1
bash scripts/pre-push-validate.sh  # full suite + typecheck + lint + dep audit
npm run build                      # production build (separate concern)
```

### Important rules

- **Never run `npm test` (full suite) after every code change** — it's wasteful and slow.
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
| UI-SEM-021 | `src/components/results/HeroSection.tsx:258` | Suppress coaching copy containing "robust"/"ready to proceed" when robustness level is low/very_low | Remove when PLoT/CEE provides robustness-conditioned coaching copy |
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
| UI-SEM-033 | `src/canvas/components/ModelTabBody.tsx:683` | Edge display defaults (weight 0.5, direction 'positive', belief 0.7) | Keep — display-only fallback |
| UI-SEM-034 | `src/adapters/plot/v1/mapper.ts:207` | V1 adapter belief clamped to [0, 1] | Keep — normalisation |
| UI-SEM-035 | `src/canvas/conversation/useConversation.ts:1086` | Weight clamp to [-1,+1] for CEE signed mean | Keep — format conversion |
| UI-SEM-036 | `src/canvas/adapters/ceeSynthesisAdapter.ts:75` | Robustness label-to-score default 0.5 for CEE synthesis | Keep — contextual, not inference |
| UI-SEM-037 | `src/canvas/adapters/islRobustnessAdapter.ts:171` | Default current_value/flip_threshold/sensitivity = 0.5 | Keep — display-only fallback |
| UI-SEM-038 | `src/canvas/utils/applyDraftResult.ts:74` | Duplicate of UI-SEM-023/024/025 on alternate ingestion path | Keep — normalisation |
| UI-SEM-039 | `src/components/results/useResultsSectionData.ts:538` | Driver semantic label thresholds (0.50 strong, 0.20 moderate) | Remove when PLoT provides semantic labels per driver |
| UI-SEM-040 | `src/components/results/useResultsSectionData.ts:1601` | Dominance detection heuristic (>0.5 influence AND ratio >2:1) | Remove when PLoT provides dominant_factor in all responses |
| UI-SEM-041 | `src/components/results/HeroSection.tsx:175` | Stability UI label thresholds (0.85/0.70/0.55) | Remove when PLoT provides stability labels directly |
| UI-SEM-042 | `src/components/results/HeroSection.tsx:243` | Fragility ratio threshold (>0.7) for trust reason | Remove when PLoT provides trust reason directly |
| UI-SEM-043 | `src/components/results/HeroSection.tsx:250` | Evidence quality threshold (<0.5) for trust reason | Remove when PLoT provides trust reason directly |
| UI-SEM-044 | `src/components/results/HeroSection.tsx:259` | Border colour classification from stability (0.7/0.4) | Remove when PLoT guarantees robustnessLevel |
| UI-SEM-045 | `src/components/results/DriversSection.tsx:175` | Rank flip warning gate (>0.3) | Remove when PLoT provides visibility gate |
| UI-SEM-046 | `src/components/results/DriversSection.tsx:212` | Elasticity display scaling (x10, floor 1) | Remove when PLoT provides shift percentage |
| UI-SEM-047 | `src/components/results/DriversSection.tsx:356` | Confidence clamped to [0, 1] | Keep — normalisation |
| UI-SEM-049 | `src/canvas/components/ModelTabBody.tsx` | VOI fallback: value_of_information * 100 as pp when evpi_percentage_points absent | Remove when PLoT guarantees evpi_percentage_points |
| UI-SEM-050 | `src/components/results/useResultsSectionData.ts` | Leading-option downside flag — true when leading option's `outcome.p10 < 0`, drives one qualifying sentence on the leader card (display-only, never affects ranking or forwarded values) | Keep — display formatting (legitimate) |
| UI-SEM-051 | `src/canvas/components/pre-analysis-v3/constants.ts` | Pre-analysis v3 bar state colour thresholds (warning <0.40, success >=0.75) | Keep — display formatting (legitimate) |
| UI-SEM-052 | `src/canvas/components/pre-analysis-v3/constants.ts` | Pre-analysis v3 bar fill denominators (options/risks saturate at 3; frame thirds; estimates degree-fallback base weight 1) | Keep — display formatting (legitimate) |
| UI-SEM-053 | `src/canvas/components/pre-analysis-v3/constants.ts` | Pre-analysis v3 gauge segment quantisation (continuous fill → lit-of-N discrete segments: round(fill·N), clamp [1,N] for positive fill, 0 when empty) | Keep — display formatting (legitimate) |
| UI-SEM-054 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero outcome-axis layout domain (min/max over existing p10/p90/centres + goal threshold only when unit-compatible; 5% pad, unit pad on degenerate span) — positions bars only, never displayed as data | Keep — display formatting (legitimate) |
| UI-SEM-055 | `src/components/results/analysis-hero/HeroOptionRow.tsx` | Analysis-hero track position clamp to [0,100]% of the track (layout only; readouts always show unclamped source values) | Keep — display formatting (legitimate) |
| UI-SEM-056 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero constraint-presence copy switch (goal-and-limits vs goal-alone wording; "and limits" only when every goal-bearing option carries constraint analysis) | Keep — display formatting (legitimate) |
| UI-SEM-057 | `src/components/results/analysis-hero/buildHeroModel.ts` | Analysis-hero sub-1% goal readout floor ("< 1%" when goalProbability < 0.01 — OptionCards parity) | Keep — display formatting (legitimate) |

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
npm run typecheck                              # TypeScript compiles?
npx vitest run --changed --bail=1              # Related tests pass?
```

If typecheck or related tests fail, fix before reporting completion.
Do NOT run `npm test` (full suite) or `npm run build` here — the fast pre-push gate
runs typecheck + lint + smoke tests at push time, and CI runs the full suite + build
post-push. See "Testing — Three-Tier Process" above.
