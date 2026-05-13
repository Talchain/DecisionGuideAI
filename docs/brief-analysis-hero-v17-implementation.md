# Brief — Analysis hero v17 implementation

**Status:** Awaiting authorisation. **Do not implement yet.** Paul will review this brief and authorise the implementation session separately.

**Single source of truth:** [`docs/investigations/analysis-hero-v17.md`](investigations/analysis-hero-v17.md). The implementation session must follow that report. **Do not re-derive or reinterpret** the state machine, row ranking, row category assignment, key-question fallbacks, footer-CTA mapping, comparison-mode behaviour, banned-term scanning strategy, provenance fallback rules, or DS token mapping.

**Design source:** [`docs/Design/analysis-hero-v17-reference.html`](Design/analysis-hero-v17-reference.html). The only design reference. Do not infer from earlier prototypes or memory.

**Branch / worktree:** continue on `claude/serene-bell-8a7861`. Do not rename.

**Risk tier:** B — user-visible Analysis-tab change, multiple data sources, gated behind a feature flag with an opt-in comparison mode.

---

## 1. Scope

In scope:

- Identity-refactor extraction of `TriageActionCardsBody` from [`DecisionConfidencePanel.tsx`](../src/components/results/DecisionConfidencePanel.tsx) (investigation §7, §9.4).
- New components under `src/components/results/`:
  - `AnalysisHeroV17.tsx`
  - `AnalysisHeroV17Top.tsx`
  - `analysisHeroV17/` subdirectory with `ReadinessColourStrip`, `HeroResultContext`, `HeroKeyQuestion`, `HeroInputRows`, `HeroFooter`, `HeroActionsMenu`, `HeroActionRow`, `buildAnalysisHeroViewModel`, `analysisHeroVM.types`, `stateSelection`, `rowRanking`.
- New flags `analysisHeroV17` and `analysisHeroCompare` added to [`src/flags.ts`](../src/flags.ts) `FLAGS_CONFIG` (investigation §9.3).
- One-time URL-param boot step that persists `?analysisHeroCompare=1` (or `=0` to clear) to localStorage via the existing flag-factory path. No per-render URL parsing.
- Flag-gated ternary at [`ResultsBody.tsx:164`](../src/components/results/ResultsBody.tsx#L164) (investigation §9.2).
- Local banned-term list at `src/test/glossaryBannedTerms.ts` (derived from the glossary rules already documented in the investigation report, §12).
- Tests covering the zero-diff DOM gate, flag-off zero-diff, flag-on substitution, comparison-mode stacking, banned-term scanner, "Fragile" label binding, and view-model unit tests (investigation §15).

Out of scope (deliberate; do not pull into this brief):

- Removal or refactor of `DecisionConfidencePanel`'s outer wrapper beyond the identity-extraction step.
- Retirement of `DecisionConfidencePanel` (separate follow-up).
- Per-factor provenance backend work for a future "User input" dimension.
- `scenario_contexts`, `framing_check`, `narrative_summary` plumbing.
- `decision_quality_prompts` renderer repair.
- Schema, migration, prompt, CEE, PLoT, package, env, or CI changes.
- Direct `addNode` / `addEdge` invocation from the hero (v1 uses chat prefill — investigation §14).
- Push, deploy, or merge to staging until explicitly authorised.

---

## 2. Required reading order (for the implementation session)

1. [`docs/investigations/analysis-hero-v17.md`](investigations/analysis-hero-v17.md) — full report, **read end to end before touching code**.
2. [`docs/Design/analysis-hero-v17-reference.html`](Design/analysis-hero-v17-reference.html) — open in a browser at the project root, click through the four prototype states.
3. [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) — DS v5 quick reference, especially the colour-opacity pattern and the `bg-{colour}-light` reservation rule.
4. [`docs/Design/Olumi_Design_System_v5.md`](Design/Olumi_Design_System_v5.md) — full DS spec.
5. [`src/components/results/DecisionConfidencePanel.tsx`](../src/components/results/DecisionConfidencePanel.tsx) — read in full before attempting the extraction.
6. [`src/components/results/ResultsBody.tsx`](../src/components/results/ResultsBody.tsx) — the substitution site.
7. [`src/components/results/useResultsSectionData.ts`](../src/components/results/useResultsSectionData.ts) and [`src/components/results/buildResultsVM.ts`](../src/components/results/buildResultsVM.ts) — data shape feeding the hero.
8. [`src/lib/flagFactory.ts`](../src/lib/flagFactory.ts) and [`src/flags.ts`](../src/flags.ts) — flag pattern.
9. [`src/canvas/stores/guidanceStore.ts`](../src/canvas/stores/guidanceStore.ts) and [`src/canvas/conversation/ConversationPanel.tsx`](../src/canvas/conversation/ConversationPanel.tsx) — chat-prefill wire.
10. [`src/canvas/components/pre-analysis/primitives/IconBtn.tsx`](../src/canvas/components/pre-analysis/primitives/IconBtn.tsx) — the reusable icon-button primitive used on each row.

---

## 3. Implementation sequence

Follow the order in investigation §16. Step numbers below match that section.

### Step 1 — Extract `TriageActionCardsBody` (HIGHEST-RISK STEP)

**This is the gate.** All subsequent steps depend on it.

1. Identify the JSX subtree currently rendered after `<TriageHealthHeader …/>` in `DecisionConfidencePanel`'s main return (roughly lines ~720–862).
2. Move that subtree into `src/components/results/TriageActionCardsBody.tsx`, accepting the same data/handler props the parent currently consumes (`data`, `onConfirm`, `onSetValue`, `expertMode`, `nodeValueLookup`, `onSendMessage`, `aiAffordance`, and the strengthen-overlay map).
3. If any internal helper in `DecisionConfidencePanel.tsx` (e.g. `mapEvidenceGapsToActions`, `mapNextActionsToCards`, `applyOverlayToItem`, `getSourcePill`) is needed by the extracted body, **hoist it to a shared module rather than duplicating**. Do not export it from `DecisionConfidencePanel.tsx`.
4. Replace the moved JSX in `DecisionConfidencePanel.tsx` with `<TriageActionCardsBody {...propsForBody} />`.
5. **Run the zero-diff DOM test** (Step 2 below) **before any v17 wiring**.

**Hard guardrails (Paul's words):**

- **The extraction must be proven by zero-diff DOM tests before any v17 wiring lands.**
- **If zero-diff cannot be achieved, stop and report.**
- **Do not proceed with partial carve-outs inside `DecisionConfidencePanel`.**
- **Do not automatically switch to a full fork without Paul's approval.**

If the zero-diff snapshot diverges for any fixture state, surface the divergence to Paul with the exact diff and the suspected coupling (refs, scroll behaviour, lexical closures). Wait for Paul's decision between (a) repairing the extraction or (b) authorising the full-fork alternative documented in investigation §7. Do not improvise.

### Step 2 — Zero-diff DOM tests for the extraction

Add a snapshot test under `src/components/results/__tests__/DecisionConfidencePanel.extraction.spec.tsx`:

- Capture a `render` snapshot per fixture state (no recommendation; single option; multi-option weak; multi-option moderate; multi-option strong; reflect-state biased). Use existing fixtures in [`src/fixtures/plot/`](../src/fixtures/plot/) where possible.
- Snapshot **before** the extraction (on a pre-refactor commit), then run the extraction, then snapshot again.
- Assert identity. Any non-identity diff blocks progress per Step 1 guardrails.

This test should remain in the repo as a regression guard — if the action-card body is refactored again later, the diff is immediately visible.

### Step 3 — View-model builder, types, and selectors

Per investigation §10–§11. Create:

- `src/components/results/analysisHeroV17/analysisHeroVM.types.ts` — typed `AnalysisHeroVM` interface.
- `src/components/results/analysisHeroV17/stateSelection.ts` — exports `selectHeroState(input)` per investigation §10 verbatim. **Do not change thresholds.** Add JSDoc citing investigation §10.
- `src/components/results/analysisHeroV17/rowRanking.ts` — exports `rankHeroRows(data)` per investigation §11.1 + §11.3. **Do not change precedence or category-assignment rules.**
- `src/components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts` — pure VM builder; orchestrates the above plus key-question selection per §11.2 and footer-CTA mapping per §11.4.

Full unit-test coverage per investigation §15.2 before any UI wiring. The VM builder must be testable in isolation against fixture `resultsSectionData` payloads.

### Step 4 — Component scaffold with static mocked VM

Per investigation §9.1 file layout. Create the components with a static mocked `AnalysisHeroVM` so visual iteration is independent of the data layer. Storybook stories per state (weak / moderate / reflect / strong) are encouraged but not required.

DS token usage per investigation §3 (no `color-mix`; use Tailwind opacity utilities such as `bg-success/[0.07]`).

Lucide icon mapping per investigation §3.5. Reuse `IconBtn`, `Pill`, `TextBtn`, `Accordion`, `Tooltip` per investigation §3.2. Do **not** introduce parallel primitive components.

### Step 5 — Wire to real data

Replace the static mocked VM with `buildAnalysisHeroViewModel(resultsSectionData, vm)` inside `AnalysisHeroV17`. Memoise per investigation §13.3.

`AnalysisHeroV17` accepts the same props `ResultsBody` already passes to `DecisionConfidencePanel`: `data`, `verifiedCount`, `influenceCoverage`, `onFocusNode`, `onConfirm`, `onSetValue`, `expertMode`, `nodeValueLookup`, `onSendMessage`, `aiAffordance`. **No new prop plumbing through `OutputsDock`**.

### Step 6 — State, fallback, action wiring

State selection, row ranking, key-question fallbacks, and footer-CTA mapping all live in the VM builder and selectors from Step 3. The components consume the VM and dispatch handlers — no logic should live in the JSX.

Action handlers per investigation §14:

- AI / Discuss → `useGuidanceStore._prefillChat` (with `_sendMessage` fallback).
- Edit → `onFocusNode(nodeId)` from props.
- Confirm → `onConfirmFactor(nodeId)` from props.
- Set value → `onSetFactorValue(nodeId, rawValue)` from props.
- Challenge → `_prefillChat` (v1 prefill only; direct `askAI` deferred to v2).
- Add → `_prefillChat` (Paul approved prefill-only for v1; direct `addNode` deferred to v2).
- Create brief → `_prefillChat` (v1 prefill only).

**Moderate-state CTA sequencing** (Paul's explicit direction):

1. Focus / select the relevant factor first via `onFocusNode(topRow.factorId)`, where reliable.
2. Then call `_prefillChat(...)`.
3. **Do not auto-send.**
4. **If focus is async, unreliable, or cannot be guaranteed cleanly, fall back to chat prefill only and document the limitation in a comment on the handler.**
5. **Do not add timing hacks, sleeps, or brittle async workarounds.**

**Updated 2026-05-13 (commit `5a610832`, Fix 9 of the round-4 polish pass):** the reflect-state CTA was relabelled "Test the result" and switched from auto-send to prefill-only. The v17 hero now has **zero auto-send paths**. The earlier "Only the reflect-state CTA auto-sends" rule from investigation §11.4 is superseded — see the updated table in §11.4 of the investigation doc.

### Step 7 — Right-aligned action row + Actions menu

Use the existing `IconBtn` primitive ([src/canvas/components/pre-analysis/primitives/IconBtn.tsx](../src/canvas/components/pre-analysis/primitives/IconBtn.tsx)). Wrap it in a thin local `HeroActionRow.tsx` for consistent right-alignment, but do not duplicate any button styling already in `IconBtn`.

Actions menu (top-right "Actions ▾"): the six static prefill prompts listed in the v17 prototype's `MENU` constant. All map to `_prefillChat`. Role-`menu` semantics per investigation §13.2.

### Step 8 — Banned-term scanner + "Fragile" binding tests

**Banned-term list location** (Paul's explicit direction):

- Create `src/test/glossaryBannedTerms.ts` exporting the canonical banned-term regex and the per-category translation hints. **Derive the list from the glossary rules already documented in [investigation §12](investigations/analysis-hero-v17.md#12-copy-glossary-and-banned-term-risks)**, not from any file in `~/Downloads` or outside the repo. The file is a test-side asset; the production hero must not import it.
- Add at minimum: `recommend`, `recommended`, `recommendation`, `winner`, `winning`, `best choice`, `graph`, `node`, `edge`, `EVPI`, `VOI`, `elasticity`, `factor sensitivity`, `sensitivity score`, `exists probability`, `belief exists`, `bias detected`, `you have a bias`, `blocked`, `cannot run`, `fix issue`, `switch probability`, `fragile edge`, `observed state`, `prior range`. (See investigation §12.1 for the canonical translations to use in fallback copy.)

Scanner must run on **three layers** (investigation §12.2):

1. Hard-coded strings in `AnalysisHeroV17/**` source files.
2. Every string field returned by `buildAnalysisHeroViewModel`.
3. Post-interpolation copy — render the hero with a fixture and run the regex over the rendered text content.

Include a test case where a fixture factor label contains a banned term (e.g. `'the winning team'`, `'graph of leads'`). Assert that the generated copy **falls back to a generic phrase** (`this estimate`, `this factor`, `the leading option`) rather than amplifying the user's label. The hero **never rewrites user data**.

"Fragile" label binding (investigation §12.3): a test that asserts `Result fragile` text appears iff `stability < 0.5`, with the right pill tint, and a complementary band label is used at other stability values.

### Step 9 — Flags + URL-param boot

In [`src/flags.ts`](../src/flags.ts) add to `FLAGS_CONFIG`:

```ts
analysisHeroV17: {
  envKey: 'VITE_FEATURE_ANALYSIS_HERO_V17',
  storageKey: 'feature.analysisHeroV17',
},
analysisHeroCompare: {
  envKey: 'VITE_FEATURE_ANALYSIS_HERO_COMPARE',
  storageKey: 'feature.analysisHeroCompare',
},
```

Export `isAnalysisHeroV17Enabled` and `isAnalysisHeroCompareEnabled` alongside the existing flag exports. No `defaultValue` (both flags default to off everywhere).

Staging deploy enables via `VITE_FEATURE_ANALYSIS_HERO_V17=1` at build time; production leaves it unset. **Do not edit any env files in this repo.** Env wiring is a deploy-config concern owned by Paul.

URL-param boot step (per investigation §9.3): add a one-time read at app entry (e.g. in [`src/main.tsx`](../src/main.tsx)) that detects `?analysisHeroCompare=1` and `?analysisHeroCompare=0` and writes to `localStorage.feature.analysisHeroCompare` accordingly. **No per-render URL parsing.** Components only read via `isAnalysisHeroCompareEnabled()`.

### Step 10 — `ResultsBody` ternary + flag-off zero-diff test

Wire the substitution at [`ResultsBody.tsx:164`](../src/components/results/ResultsBody.tsx#L164) per the JSX pattern in investigation §9.2.

Add a zero-diff test that snapshots `ResultsBody` rendering with both flags unset and asserts structural identity to a pre-change baseline. This proves the implementation is truly additive for users not opted in.

### Step 11 — Verify lower Analysis sections are untouched

Open the storybook story or render the staging app with both flags on. Confirm:

- `OptionCards`, `RiskAppetiteFilter`, `WinGauge`, `DriversSection`, `TornadoChart`, `StressTestSection`, `AdvancedSection` all render unchanged.
- Stale-state wrapping behaviour from [`OutputsDock.tsx:1595-1599`](../src/canvas/components/OutputsDock.tsx#L1595) still applies to the new hero (verify via a manual stale-state test, then a unit test if cheap).

### Step 12 — Manual staging smoke

Per investigation §15.8. Cover weak / moderate / reflect / strong states + comparison-mode toggle + pre-analysis unaffected. Capture screenshots; do not push or deploy until Paul has reviewed them.

---

## 4. Hard guardrails

These restate Paul's direction and the investigation report's stop conditions. Re-read before each PR / commit.

### 4.1 Extraction gate

- **Zero-diff DOM tests must pass before any v17 wiring is merged.**
- **If zero-diff cannot be achieved, stop and report.**
- **Do not proceed with a partial carve-out inside `DecisionConfidencePanel`.**
- **Do not switch to a full fork without Paul's explicit approval.**

### 4.2 Copy / glossary

- The banned-term scanner must run on hard-coded strings, VM output, and post-interpolation copy.
- Never rewrite a user-supplied label. If interpolating a label causes a glossary hit, fall back to a generic phrase.
- Never emit raw normalised values (`0.71`), factor IDs, or internal terms (`headline_type`, `voi`, `exists_probability`, `node`, `edge`, `ISL`, `PLoT`, `CEE`).

### 4.3 Flag behaviour

- `analysisHeroV17` is off by default everywhere. Staging enables via env var at build time; production stays unset.
- `analysisHeroCompare` is opt-in only. Never default-on.
- `?analysisHeroCompare=1` persists through the localStorage path. `?analysisHeroCompare=0` clears it.
- No per-render URL parsing.

### 4.4 Out-of-scope changes that should trigger a stop

If any of the following appears necessary, **stop and surface to Paul** rather than expanding scope:

- Backend / prompt / schema / migration changes.
- `package.json` / lockfile / env-file edits.
- New CI workflow steps.
- Edits to sections below the hero in `ResultsBody`.
- Edits to canvas-store state shape, action signatures, or selectors.
- New CEE / PLoT request fields.
- Adding `color-mix` to production CSS.

### 4.5 Branch / commit / push

- Continue on `claude/serene-bell-8a7861`.
- Commit incrementally. Tier-1 smoke (`npm run typecheck` + `npx vitest run --changed --bail=1`) after each task per [`CLAUDE.md`](../CLAUDE.md).
- **Do not push to remote and do not deploy** until Paul has reviewed the implementation and explicitly authorised it.

---

## 5. Definition of done

The implementation session can report done only when **all** of the following are true:

1. `TriageActionCardsBody.tsx` exists; `DecisionConfidencePanel` is a thin wrapper. Zero-diff DOM tests pass for every fixture state.
2. `AnalysisHeroV17` and its subcomponents exist. Render correctly across weak / moderate / reflect / strong with mocked and real VM data.
3. `buildAnalysisHeroViewModel` has full unit coverage per investigation §15.2. All thresholds match the report verbatim.
4. Banned-term scanner runs in CI-style (locally) on hard-coded strings, VM output, and post-interpolation copy. The user-label fallback test passes.
5. "Fragile" label binding test passes.
6. `analysisHeroV17` and `analysisHeroCompare` flags exist with the documented `envKey` / `storageKey` pairs. URL-param boot step persists comparison state to localStorage.
7. `ResultsBody` ternary correctly switches at [line 164](../src/components/results/ResultsBody.tsx#L164). Flag-off zero-diff test passes. Flag-on substitution test passes. Comparison-mode stacking test passes.
8. Lower Analysis sections render unchanged. Pre-analysis branch unchanged. Stale-state wrapping still applies.
9. Tier-1 smoke checks pass locally (`npm run typecheck`, `npx vitest run --changed --bail=1`).
10. Implementation session writes a short summary at the bottom of `docs/investigations/analysis-hero-v17.md` (or a sibling completion note) listing: extraction snapshot results, any deviations from the report, screenshots from staging-smoke states (if staging deploy is later authorised), and any new follow-ups discovered during implementation.
11. **Nothing has been pushed or deployed.** Paul reviews local commits before authorising the push.

---

## 6. Follow-ups (do not implement in this brief)

Per investigation §18 — explicitly out of scope here; flagged for separate authorisation:

1. Retire `DecisionConfidencePanel`'s outer wrapper once v17 hero is approved.
2. Per-factor provenance backend → revives the "User input" dimension.
3. `scenario_contexts` plumbing → enables the descriptive reason line.
4. `decision_quality_prompts` renderer repair → improves Key-question card reliability.
5. Direct `addNode` / `addEdge` wiring for the "Add" hero action.

Each follow-up is its own brief. Do not bundle.

---

## 7. Open questions for the implementation session

None at brief-writing time. Paul has resolved every open question raised during Phase 0 (see investigation §18). If new questions arise during implementation, surface them to Paul rather than guessing — particularly around extraction-couplings, key-question template edge cases, or banned-term ambiguity.
