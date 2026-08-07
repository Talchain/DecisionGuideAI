# Lane 1 — display-coherence hotfix (evidence report)

Branch: `claude-lane1/display-coherence-hotfix` (worktree from `origin/staging` @ `c048f4e8`)
Scope: demo-critical display honesty only — no computation, payload, schema, layout-system, CAS or prompt changes. Contracts frozen; nothing crossing a service boundary was touched.

## A. Goal-fit null-target suppression (UI-SEM-071)

### Evidence chain (verified on origin/staging before any edit)

1. **Request omits the threshold** — `src/adapters/plot/v2/adapter.ts:1279`: `...(analysisReady?.goal_threshold != null && { goal_threshold: ... })` — with no user target, no `goal_threshold` is sent.
2. **Selector adopts the synthesized value** — `src/components/results/useResultsSectionData.ts:1187-1196`: `goalProbability = hasConstraints && jointGoalProb != null ? jointGoalProb : (unconstrained ?? jointGoalProb)` — the final `?? jointGoalProb` fallback adopts `probability_of_joint_goal` even when the joint value derives from ISL's `auto_goal_threshold` (a target the user never set).
3. **Hero gated on value presence, not the user target** — `buildHeroModel.ts` (pre-fix): `goalAvailable = rows.some(r => r.goal.value != null)` (old :281), `defaultLens: goalAvailable ? 'goal' : 'outcome'` (old :593), `goalLeaderRow` guard checked only value ≥ sub-1% floor (old :424-29) — `goalThreshold` was in scope (old :201) but unused for the claim. Result: identical synthesized "98% fit" bars as the DEFAULT lens plus a "best fits your goal" headline.
4. **The intended hide path existed but only fired when values were absent** — `heroCopy.ts:39` (`lensUnavailable.goalNoTarget`), `showGoalHint` (old :616).

### Fix (buildHeroModel.ts only; suppression, no value transforms)

- `hasUserTarget = goalThreshold != null` (the USER threshold: `recommendation.goalThreshold` = `effectiveGoalThreshold`, derived exclusively from canvas store → CEE `goal_threshold_raw` → goal-node data at `useResultsSectionData.ts:1045-1068` — never from PLoT/ISL output, so a synthesized value cannot masquerade as a user target).
- Row-level gate: `goalValue = hasUserTarget ? (o.goalProbability ?? null) : null` — nulls every row's goal slot (bar value, readout → '—', `goalFit` detail line) at source.
- `goalAvailable = hasUserTarget && rows.some(...)` — explicit belt-and-braces term.
- `goalLeaderRow` gains an explicit `hasUserTarget &&` term (claim gate cannot be re-opened by a row-mapping change).
- Downstream automatically: goal lens unavailable → needs-target copy ("Set a success target to unlock Goal fit.", the existing `showGoalHint`/`goalNoTarget` path); `defaultLens` falls back to `'outcome'`; `allGoalBelowFloor` false (no "on track" claim without a target); `leaders.goal` null; `showGoalHint` true (footer promotes the set-a-target action).
- With a real threshold every path is byte-identical to before (verified by the full existing hero suite + explicit preservation tests).
- Honest degradation note: null target + goal values + NO outcome ranges now renders the hero's `empty` state (previously: synthesized goal bars). Nothing displayable is the honest answer there.

## B. Stability honesty (postAnalysisFooter + OutputsDock)

Evidence: `useResultsSectionData.ts:1400` hardcodes `robustnessVerdict: undefined` (no display-safe verdict in the contract) → footer status is always "Robustness unknown" (`derivePostFooterStatus`), while `OutputsDock.tsx:1003` fed raw `recommendation_stability ?? ranking_stability` into `derivePostFooterMeta` (`postAnalysisFooter.ts:91-101`), rendering "59% stability" beside it — and that number is numerically the leader's win probability.

Fix: `derivePostFooterMeta` now takes `robustnessVerdict` and appends the "{N}% stability" segment ONLY when the verdict is one of the exact display-safe enum values (`high|moderate|low|very_low` — allowlist, runtime-safe like the status; malformed values suppress). OutputsDock passes the same verdict field the status uses. Suppressed, never relabelled; evidence-gap text unaffected. With the live contract (verdict always undefined) the segment never renders.

## C. Axis-label run-on (AnalysisHeroPanel.tsx)

Evidence: `heroCopy.ts:127` `axis.goalOnly {left:'0%', mid:'chance of hitting goal', right:'100%'}` rendered with the mid label ABSOLUTELY positioned (`absolute left-1/2 -translate-x-1/2 whitespace-nowrap`) over the in-flow end labels (`AnalysisHeroPanel.tsx:288-98`) — at narrow width the fragments collide and read as the sentence "0% chance of hitting goal 100%".

Fix: the three fragments are now in-flow flex items (`justify-between gap-2`), mid `min-w-0 truncate` — overlap is geometrically impossible; at narrow width the mid ellipsizes instead of touching the end labels. Copy strings unchanged. (After fix A the goal axis additionally renders only when a real target exists.)

## D. Panel overlap — reproduce-check only (no code change)

Claim type: static structural trace on this worktree (origin/staging @ c048f4e8); no live browser run (canvas requires authed backends).

- **On load: does NOT reproduce.** `useFloatingPanelState` has NO persist middleware — `isOpen: false`, `position: null` are in-memory defaults (`useFloatingPanelState.ts:71,75`), and `FloatingOlumiPanel` returns `null` when `!isOpen` (`FloatingOlumiPanel.tsx:823`). A fresh page load over a populated graph renders no floating panel, hence no overlap.
- **In-session: the overlap condition IS live again.** The revert `b9b0890b` (origin/staging, no stated reason in the message) restored `position ?? defaultCentredPosition(...)` (`FloatingOlumiPanel.tsx:490`): the FIRST open of the floating panel in a session with no stored position opens CENTRED. Over a populated canvas (e.g. first float-out via `OutputsDock.floatOutToWindow`) it lands over the graph. The empty-canvas auto-open (`open('system-first-use')`, `OutputsDock.tsx:504`) has nothing to overlap, and the 0→N draft transition self-heals ONLY under the FirstUseComposer guards (`isOpen && canAutoDock && userSentFromFirstUseRef`, `FirstUseComposer.tsx:133-140`) — drafts arriving outside that path leave the centred panel over the new graph.
- **Not implemented** (per brief): did not reapply 9f773e36. Followup noted below.

## Tests & gates run (this worktree)

- `npx vitest run src/components/results/analysis-hero/__tests__/` → **11 files, 195 tests, all pass** (includes the new `nullTargetSuppression.spec.tsx`, 13 tests: null-target → no bars/claims/axis, needs-target state, default lens outcome, undefined==null, below-floor no-claim, outcome untouched; real-threshold preservation, both model- and render-level; axis in-flow/gap structural pin).
- `npx vitest run src/canvas/components/utils/__tests__/postAnalysisFooter.spec.ts` → **25 tests pass** (new: unknown/null/malformed verdict suppress "{N}% stability" incl. the live 0.59 case; evidence text survives alone; every known verdict unlocks).
- `npx vitest run src/canvas/components/utils/__tests__/robustnessSingleSource.render.spec.tsx` → 7 pass (footer render surface unaffected).
- `pnpm run typecheck` (tsc -p tsconfig.ci.json, the repo gate) → **clean, exit 0**.
- `npx tsc -p tsconfig.app.json --noEmit` → 3980 error lines, **identical count on clean origin/staging (stash/unstash comparison)** — all pre-existing, none in changed files (grep over changed paths matched only the pre-existing `OutputsDock.dom.spec.tsx`/`.stories.tsx` errors, files not touched here; that spec is also excluded from the vitest config).
- Full suite NOT run locally (repo rule: OOMs the machine; CI is the authoritative full gate).

## Followups (not implemented)

- **D:** trivial-fix candidate for the in-session centred first-open: persist `position` (session-scoped) or re-land 9f773e36's anchored default — blocked on learning why `b9b0890b` reverted it (revert message carries no reason).
- `ResultsFooter` (separate Results-Panel surface, `src/components/results/ResultsFooter.tsx`) still derives "Stable result · N%" wording from raw stability via its own path — outside this hotfix's named scope (OutputsDock footer), flagging for the robustness-verdict-contract owner.
- The other selector surfaces that consume the collapsed `goalProbability` (OptionCards "likely to reach target", etc.) still show synthesized values without a user target; this hotfix gated the hero (the named scope). Producer-side fix (PLoT/CEE distinguishing user vs auto threshold provenance) is the durable close.
