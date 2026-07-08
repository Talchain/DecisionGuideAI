# Lane 35 — three display-honesty fixes (claim integrity)

**Branch:** `claude-lane35/claim-integrity` · **Base:** `origin/staging` @ `eeea43d2`
**Doctrine:** render producer meaning, never invent/repair; additive only; RED-first.

The product must not misattribute numbers. Three verified misattributions, one lane:

## Fix 1 — hero goal-fit crown conflation (buildHeroModel)

**Evidence:** `acceptance-evidence/goal-fit/6b-browser/` (2026-07-08): on the Goal fit
lens the WIN-probability leader ("Relocate to Manchester", **4% fit**) was crowned
"best fits your goal" + "(Leads on this view)" over rivals at **7%** and **6%**.
`goalLeaderRow` re-used the recommendation (win) leader and gated only on the sub-1%
floor — it never compared fits.

**Fix (UI-SEM-072):** the goal-fit crown (headline + goal-lens leader ring) is the
`goalProbability` **argmax** — never the recommendation re-crowned onto a view it does
not lead. Crown withheld (no crown rather than a wrong crown) unless: a user target
exists (UI-SEM-071), **every** row carries its own goal probability, the max is
**uniquely** held, and it clears the shared sub-1% floor (UI-SEM-057). Fallbacks are
the existing honest branches (banded analysis-leader headline, no ring). The tension
subline now compares the **actually-headlined** row against the outcome leader.

## Fix 2 — pre-analysis success-target provenance mislabel

The pre-analysis v3 hero "Success" field chip said **"Olumi estimate"** for every
CEE-derived display anchor (`goal_threshold_raw`), including targets the user stated
in their own brief — stored goal constraints with `provenance: 'explicit'` (CEE
`schemas/assist.ts` emits `explicit | inferred | proxy`).

**Fix:** `computeSuccessState` now receives the stored goal constraints
(`store.goalConstraints`, ingested verbatim by DraftChat/applyDraftResult). When the
displayed raw value **equals** an `'explicit'`-provenance constraint's value, the
attribution is the user (`kind: 'person'`) and the chip renders **"Your target"**;
`'Olumi estimate'` remains for derived/defaulted values (inferred/proxy/no provenance)
and any value mismatch (fail-closed — never claims user-set wrongly).

## Fix 3 — consume robustness.display_verdict (ROADMAP 1.6)

PLoT emits display-safe `robustness.display_verdict`
(`robust | moderate | fragile | not_assessed`) + `display_verdict_reason` since #202;
the UI read nothing (`robustnessVerdict: undefined` hardcoded) so every surface stayed
"Robustness unknown" forever.

**Fix:** read the field via the repo's tagged-passthrough convention for untyped
reads — declared on the repo's own `V2RobustnessActual` wire type (vendored
`@talchain/schemas` is 0.13.1; 0.14.0 types the envelope but the pin bump is the
separate rollout step 4 — NOT bumped in this lane), narrow raw-response selector reads
with mapped-report fallback (same pattern as `rawFlipThresholdsStatus`), passthrough in
`responseMapper` so hydrated runs keep it. Fail-closed normalisation: only the four
producer tokens populate `recommendation.robustnessVerdict`; the producer's reason is
carried verbatim in `robustnessVerdictReason` and never exposed without its verdict.
Consumers (post-analysis footer, results checks glyph, hero V17 state/result line)
render the producer verdict + reason verbatim; the hardcoded "Robustness unknown"
remains ONLY when the field is absent (older PLoT builds).

## Verification

- RED-first specs per fix (see PR body for the exact RED→GREEN evidence).
- Gates: `pnpm run typecheck` (tsconfig.ci.json) + targeted vitest on touched files
  only (full local suite OOMs by policy; "Staging Tests" CI is chronically red
  pre-existing — vitest OOM truncation).
