# Lane 37 — goal-fit modelled-basis caveat completeness (1.6b follow-up, claim-integrity)

**Branch:** `claude-ui/goalfit-caveat-completeness` (worktree, base `origin/staging` @ `fc14e794`, tip includes #241/#240)
**Zone:** spans Zone A (canvas — `useNodeDisplayMetadata.ts`, `GoalNode.tsx`) and Zone B (analysis tab —
`analysis-hero/buildHeroModel.ts`, `HeroOptionRow.tsx`). **Both incoming zone-owner lanes should rebase
past this branch** before continuing work in either file.

## Context

PR #241 (1.6b) added the `goal_fit_basis` modelled-basis caveat to `OptionCards.tsx`, gated on
`option.goalFitIsModelledBasis === true` (itself gated in `useResultsSectionData.ts` on the
number shown being the joint-goal figure AND `goal_fit_basis.scored_from ===
'modelled_outcome_distribution'`). That lane's own residuals section flagged two secondary
render sites, deliberately left untouched to keep the lane minimal:

1. The analysis-hero detail line (`analysis-hero/buildHeroModel.ts`'s `goalFit` copy,
   rendered by `HeroOptionRow.tsx`).
2. "the canvas node badge (`useNodeDisplayMetadata.ts` → **some** node-badge component)" —
   the lane doc itself left the exact consuming component unidentified.

Both derive from `probability_of_joint_goal` and showed the number with no caveat — the same
honesty gap 1.6b closed at the primary site.

## STEP 1 — confirming the two sites

- **Hero:** `buildHeroModel.ts` builds `detail.goalFit` from `o.goalProbability` (the already-collapsed
  joint/unconstrained value `OptionResult.goalFitIsModelledBasis` already flags — computed once by
  `useResultsSectionData.ts`, unchanged by this lane) and `HeroOptionRow.tsx` renders it verbatim
  with `data-testid="hero-detail-goal-fit"`. Confirmed: a real goal-fit number render site, no caveat.
- **Canvas node badge:** `useNodeDisplayMetadata.ts` independently derives `achievementProbability`
  from the canvas store's `report.option_probabilities[recommendedOptionId]` (a different read path
  than `useResultsSectionData.ts` — this hook is NOT shape-touched by this lane) using its own
  `hasConstraints && jointProb != null` branch, but never read `goal_fit_basis` at all. Of its three
  consumers (`GoalNode.tsx`'s "X% chance of reaching target", `OutcomeNode.tsx`'s "Achievement: X%"
  diagnostic, `NodeInspector.tsx`'s inspector-panel readout), **`GoalNode.tsx` is treated as THE
  primary node-badge** for this lane — it is the direct canvas analogue of OptionCards' "Hits target"
  claim (a goal node's own on-canvas achievement-probability display), matching the "primary,
  highest-traffic render site" precedent 1.6b itself set for OptionCards vs. other panels.
  `OutcomeNode.tsx`'s secondary diagnostic line and `NodeInspector.tsx`'s panel readout are NOT
  touched here — same claim-integrity gap, filed as a residual below rather than expanded into
  gratuitously per this lane's additive/minimal scope.

Both confirmed sites render a real goal-fit number with no caveat before this lane. No invented
caveats — every gate mirrors an existing branch exactly (see below).

## STEP 2 — implementation (additive only)

- **Shared copy, single source:** `src/components/results/utils/goalFitBasisCaveatCopy.ts` exports
  `GOAL_FIT_BASIS_CAVEAT_COPY` — the exact sentence OptionCards used inline. OptionCards.tsx now
  imports it too (no wording drift possible across sites).
- **Hero (`buildHeroModel.ts` + `heroTypes.ts` + `HeroOptionRow.tsx`):** added `HeroRowDetail.goalFitCaveat?:
  string`, computed as `goalValue != null && o.goalFitIsModelledBasis === true ? GOAL_FIT_BASIS_CAVEAT_COPY
  : undefined` — i.e. gated on the SAME `goalFitIsModelledBasis` flag OptionCards gates on, additionally
  requiring the goal number is actually shown (`goalValue != null`, honouring UI-SEM-071's
  null-user-target suppression). Rendered by `HeroOptionRow.tsx` immediately below `detail.goalFit`,
  `data-testid="hero-detail-goal-fit-caveat"`.
- **Canvas node badge (`useNodeDisplayMetadata.ts` + `GoalNode.tsx`):** added
  `achievementProbabilityIsModelledBasis: boolean` to the hook's return, computed by mirroring the
  hook's OWN existing `isJoint = hasConstraints && jointProb != null` branch (not
  `useResultsSectionData.ts`'s — a different read path, no shape change to either) AND
  `rec.goal_fit_basis?.scored_from === 'modelled_outcome_distribution'`. `GoalNode.tsx` renders the
  shared caveat copy immediately below the "X% chance of reaching target" line when both
  `achievementProbability !== null` and the new flag are true, `data-testid="goal-fit-basis-caveat-node"`.
- No changes to `useResultsSectionData.ts`'s shape, `mapV5AnalysisToReport.ts`, the schemas pin, or
  `canvas/store` — the hero reads an already-existing field, the node-badge hook computes its own
  flag from data it already reads.

## STEP 3 — RED-first, verified via `git stash`

Three independent stash/re-run cycles (fix files only, tests untouched):

1. `buildHeroModel.goalFitBasisCaveat.spec.tsx` (new) — stashing `buildHeroModel.ts` +
   `heroTypes.ts` + `HeroOptionRow.tsx`: 1 of 3 mapper-level tests failed pre-fix (`goalFitCaveat`
   undefined instead of the copy string; the honest-absence and null-target-suppression cases pass
   both sides, as expected of an absence assertion) + 1 of 2 component-render tests failed
   (`getByTestId('hero-detail-goal-fit-caveat')` not found). Both green after restoring.
2. `useNodeDisplayMetadata.spec.ts` (extended) — stashing `useNodeDisplayMetadata.ts`: all 4 new
   `achievementProbabilityIsModelledBasis` tests failed pre-fix (`undefined` vs. the expected
   boolean). Green after restoring.
3. `GoalNode.spec.tsx` (extended) — stashing `GoalNode.tsx`: the "renders caveat when flagged" test
   failed pre-fix (`getByTestId('goal-fit-basis-caveat-node')` not found); the "no caveat when absent"
   case passed both sides (honest-absence). Green after restoring.

## Verification

- **Typecheck:** `pnpm run typecheck` (`tsc -p tsconfig.ci.json --noEmit`) — clean.
- **Targeted vitest** (all touched files + siblings, run together): **465 passed / 0 failed** across
  16 files — `OptionCards.spec.tsx`, `OptionCards.goalFitBasisCaveat.spec.tsx`,
  `OptionCards.displayHonesty.spec.tsx`, `OptionCards.brief-5_1.spec.tsx`,
  `OptionCards.showAllCollision.spec.tsx`, `OptionCards.v5-visible-render.spec.tsx`,
  `buildHeroModel.spec.ts`, `buildHeroModel.goalFitBasisCaveat.spec.tsx` (new), `content.spec.tsx`,
  `interaction.spec.tsx`, `useNodeDisplayMetadata.spec.ts`, `GoalNode.spec.tsx`,
  `OutcomeNode.spec.tsx`, `OptionNode.spec.tsx`, `RiskNode.spec.tsx`, `FactorNode.spec.tsx`.
- **`--changed` sweep:** 2 pre-existing failures, both verified byte-identical (same failing count,
  same messages) on unmodified `origin/staging` via `git stash` on all lane files + re-run:
  - `ResultsBody.heroPlacement.spec.tsx` — 3/7 tests fail in isolation both with and without this
    lane's changes (test-isolation flake independent of this diff — the file also produced a
    *different* failure count when run bundled with unrelated suites in the full `--changed` sweep,
    confirming cross-file pollution rather than a real regression).
  - `OutputsDock.analysis-run.spec.tsx` — fails at import time with "Missing Supabase environment
    variables" (`src/lib/supabase.ts`), an environment/config issue unrelated to any file this lane
    touches.
  Neither chased, per the chronic-CI-red disclosure convention (ROADMAP 1.26 class). "Staging Tests"
  CI chronic red is also pre-existing — disclosed, not chased.
- Full local suite NOT run (OOMs by policy).

## Residuals (follow-ups, not this lane)

1. **`OutcomeNode.tsx`'s "Achievement: X%" diagnostic line and `NodeInspector.tsx`'s inspector-panel
   readout** both consume the same `useNodeDisplayMetadata.ts` `achievementProbability` /
   `achievementProbabilityIsModelledBasis` pair this lane now computes, but neither renders the
   caveat — left untouched to keep this lane's canvas-side scope to the one primary node-badge site
   (`GoalNode.tsx`), matching 1.6b's own precedent of shipping the primary render site first. Both
   are one-line additions once a follow-up lane decides they're worth the same honesty treatment
   (the flag is already computed and available on the hook's return).
