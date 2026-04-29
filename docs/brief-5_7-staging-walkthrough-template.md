# Brief 5.7 — Walkthrough (local preview artefacts)

Per AGENTS.md §1: every acceptance-criterion row records one concrete artefact (DOM excerpt, test-output line, console assertion, or build output). The branch is local only — no staging deployment yet — so the artefacts come from the local preview (`npm run build`) and from the regression test suite. When this hotfix later deploys to staging, a second pass should layer staging-bundle screenshots over the same template.

Tester: Paul Lee (local, automated)
Date: 2026-04-29
Branch: `ui/analysis-tab-hotfix-5_7`
Branch range: `b4e6ac97..HEAD` — D1..D7 originals + D8 docs + D5/D6/D7 follow-ups + close-out docs. This file lives on the branch it documents and cannot self-reference its own commit hash; run `git log --oneline ui/analysis-tab-hotfix-5_7` for the live ordering.
Build: `npm run build` → `✓ built in 25.70s` (no errors)
Scoped vitest: 1555 passed / 13 skipped / 0 failed across `src/components/results` + `src/canvas/components/pre-analysis`

---

## D2 — Model checks card removed

**Setup:** any decision graph where prior science-nudge conditions would have fired (top driver influence ≥ 60% AND/OR contested edges with EVOI > 2pp).

**Expected:**
- No card with the heading "Model checks" appears in the Results panel.
- No subtitle "Structural signals that may affect the result" anywhere on the panel.
- The dominant-factor warning in DriversSection still carries factor name + N% drives + Validate/Research chips when influence ≥ 80%.

**Forbidden:** standalone factor card under a "Model checks" heading reappearing.

**Evidence:**

```
$ rg -n "Model checks" src/components/results/
(zero hits)

$ rg -n "ScienceNudgeCard|scienceNudges|buildScienceNudges" src/components/results/
(zero hits)
```

`DecisionConfidencePanel.tsx` import line at file head no longer references `Lightbulb` (D2 commit `53904990` removed the dead import). The DCP-touching test files all pass:

```
✓ src/components/results/__tests__/DecisionConfidencePanel.caveatGuarantee.spec.tsx  (8 tests)
✓ src/components/results/__tests__/DecisionConfidencePanel.semanticCoherence.spec.tsx  (5 tests)
✓ src/components/results/__tests__/HeroFooterComposed.spec.tsx  (5 tests)
```

Production build succeeds with the dead-coded surface gone.

**Sign-off:** local artefacts captured; staging walkthrough deferred until deployment.

---

## D3 — Validate chip on dominant-factor warning

**Setup:** decision where one factor has ≥ 80% influence post-analysis but `data.dominantFactorId` is NOT set by PLoT.

**Expected:** both Validate and Research chips render. Clicking Validate calls `onFocusNode` with the topDriver's `matchedNodeId` (or `factorKey` fallback).

**Forbidden:** only Research rendering.

**Evidence:** `DriversSection.dominantWarning.spec.tsx` runs three regression cases that exactly mimic the staging-pre-fix conditions:

```
✓ DriversSection: dominant-factor warning > renders Validate chip when dominantFactorId is absent but topDriver has matchedNodeId
✓ DriversSection: dominant-factor warning > falls back to factorKey when neither dominantFactorId nor matchedNodeId is present
✓ DriversSection: dominant-factor warning > omits Validate chip when no focus target is available at all
```

Click-through assertion (from the first case): the test invokes `validate.click()` and asserts `onFocusNode` was called with `'node-customer-churn'` — the topDriver's `matchedNodeId`.

**Sign-off:** local artefacts captured; staging walkthrough deferred until deployment.

---

## D4 — Confidence bar in driver rows

**Setup:** any decision with at least three drivers post-analysis, varying confidence values across the rows.

**Expected:** each driver row's confidence column renders a single thin horizontal bar (`h-1`, `bg-info`, `bg-panel-hover` track) plus a numeric percentage in `font-mono text-text-light`. Empty/missing rows show "-" placeholder.

**Forbidden:** 4-dot indicator reappearing.

**Evidence:**

```
$ rg -n "filledSteps|filled-dot|unfilled-dot" src/components/results/DriversSection.tsx
(zero hits)
```

DOM-shape assertions in `DriversSection.confidence-bar.spec.tsx`:

```
✓ DriversSection confidence bar rendering > renders thin bar (bg-info, h-1) plus percentage readout for confidence: 0.6
  → bar.toHaveClass('h-1', 'bg-panel-hover', 'rounded-full')
  → fill.toHaveClass('bg-info', 'rounded-full')
  → fill.toHaveStyle({ width: '60%' })
  → screen.getByText('60%') in document
✓ DriversSection confidence bar rendering > does not render any 4-dot indicator (no bg-text-body w-2 h-2 spans inside the confidence column)
  → container.querySelectorAll('span.w-2.h-2.rounded-full.bg-text-body').length === 0
```

Spec amendment recorded at `docs/brief-5_5-visual-system-spec.md` §2.2 Pattern C with the new code snippet (uses `typography.panelBody` token, not raw `text-[12px]`).

**Sign-off:** local artefacts captured; staging walkthrough deferred until deployment.

---

## D5 — Authority bias card with concrete target factor

**Setup A (target supplied + resolves):** CEE response with `bias_findings: [{ code: 'AUTHORITY_BIAS', explanation: '…', target_factor_id: 'fac-1' }]` + graph node `{ id: 'fac-1', data: { label: 'Engineering velocity' } }`.

**Setup B (target supplied but unresolvable):** same finding but `target_factor_id: 'fac-missing'` not present in `nodes`.

**Setup C (no target):** finding with no `target_factor_id`.

**Expected:**
- Setup A: card title reads "Authority bias on Engineering velocity"; subtitle reads "Watch for authority bias on Engineering velocity. <CEE explanation>".
- Setup B: card absent.
- Setup C: card absent (per the original D5 filter).

**Forbidden:** any card rendering with the literal "Watch for this bias when reviewing the items below" copy. Any AUTHORITY_BIAS card without a named factor.

**Evidence:**

```
$ rg -n "Watch for this bias" src/
(zero hits — gate clean)
```

Component-level render tests in `PreAnalysisPanel.brief57.spec.tsx`:

```
✓ PreAnalysisPanel — Brief 5.7 D5 component-level render > renders an AUTHORITY_BIAS card whose copy names the resolved target factor
  → screen.getByText('Authority bias on Engineering velocity') in document
  → screen.getByText(/Watch for authority bias on Engineering velocity\./i) in document
  → forbidden-substring DOM probe returns false
✓ PreAnalysisPanel — Brief 5.7 D5 component-level render > suppresses an AUTHORITY_BIAS card whose target_factor_id does not resolve to any graph node
  → screen.queryByText(/Authority bias/i) is null
```

Pure-logic coverage (8 cases) in `normaliseCeeBiasFinding.spec.ts` covers: null-on-missing-explanation, target-resolved title augmentation, unresolvable suppression, whitespace handling, BIAS_FALLBACK title path.

Predicate-level coverage (9 cases) in `shouldSuppressBiasFinding.spec.ts` covers: AUTHORITY_BIAS without target → suppressed; other bias kinds without target → not suppressed; case insensitivity; code-vs-type precedence.

**Sign-off:** local artefacts captured; staging walkthrough deferred until deployment.

---

## D6 — Top evidence split (Path B)

**Setup A (gaps + actions):** 2 evidence gaps + 1 next-action suggestion.
**Setup B (gaps only):** 2 evidence gaps + 0 next actions.
**Setup C (actions only):** 0 evidence gaps + 1 next-action suggestion.
**Setup D (both empty):** 0 of each.

**Expected:**
- A: both blocks render. "Highest-value evidence gaps" header (TrustSummary) above 2 gap cards (1, 2). "Suggested next actions" subheader above 1 action card (3).
- B: only the gap block + "Highest-value evidence gaps" header.
- C: only the next-actions block + its subheader. **NO** "Highest-value evidence gaps" header (P1.2 fix).
- D: neither block renders.

**Forbidden:** "Highest-value evidence gaps" header rendering above an empty zone or above next-action-only cards.

**Evidence:** `DecisionConfidencePanel.topEvidenceSplit.spec.tsx` — 6 cases covering all four setups plus the mixed-state header check:

```
✓ renders only the evidence-gap block when no next actions present
✓ renders only the next-actions block when no evidence gaps present
✓ renders both blocks when mixed; ordinals continue across the split
✓ does not render either block when both inputs empty
✓ hides the evidence-gap header in next-actions-only states (P1.2)
✓ still renders the evidence-gap header when at least one evidence gap is present, even with mixed cards
```

Ordinal continuation asserted via `evidenceBlock.querySelectorAll('[data-testid^="triage-card"]').length === 2` and `nextActionsBlock.querySelectorAll('[data-testid^="triage-card"]').length === 1`.

**Sign-off:** local artefacts captured; staging walkthrough deferred until deployment.

---

## D7 — Confirm action on AI-estimated factors

**Setup:** Pre-analysis Improve confidence with one cee_inference verify item that has NO native action attached (forces the defensive augmentation path).

**Expected:** Confirm chip (Check icon, tooltip "Confirm AI estimate") renders. Clicking it invokes `useCanvasStore.updateNode(nodeId, …)` with `data.observedState.source === 'user_confirmed'`.

**Forbidden:** AI-estimated card rendering without a Confirm action; click-through writing any source other than `user_confirmed`.

**Evidence:** click-through assertion in `PreAnalysisPanel.brief57.spec.tsx`:

```
✓ PreAnalysisPanel — Brief 5.7 D7 component-level render > renders a Confirm action and clicking it calls updateNode with source=user_confirmed
  → confirmButton found via within(cardsBlock).getByRole('button', { name: /Confirm AI estimate/i })
  → fireEvent.click(confirmButton)
  → mockUpdateNode called once with nodeId 'fac-1'
  → patch.data.observedState.source === 'user_confirmed'
```

Helper-level coverage (6 cases) in `augmentAiEstimatedItemWithConfirm.spec.ts` covers: action attachment when missing, identity passthrough when already present, non-confirm action preservation, no-target passthrough, no-mutation invariant.

**Sign-off:** local artefacts captured; staging walkthrough deferred until deployment.

---

## Cross-cutting acceptance

```
$ npm run typecheck
✓ tsc -p tsconfig.ci.json --noEmit (clean)

$ npx vitest run src/components/results src/canvas/components/pre-analysis
Test Files  88 passed | 1 skipped (89)
Tests       1555 passed | 13 skipped (1568)
Duration    ~36s

$ npm run build
✓ built in 25.70s (production bundle, no errors)

# Brief 5.7 D8 gates
$ rg -n "Model checks" src/components/results/                                   → zero hits
$ rg -n "Watch for this bias" src/                                                → zero hits
$ rg -n "filledSteps|filled-dot|unfilled-dot" src/components/results/DriversSection.tsx → zero hits

# Brief 5.5 §2.8 gates (all): zero or documented (see final-review doc)
# Brief 5.6 §2.6 gates (all): conform (see final-review doc)
```

---

## Final sign-off

Local QA: Paul Lee (automated test sweep + grep gate verification + production build) — 2026-04-29
Owner: __________________  Date: __________

**Staging follow-up required:** when this hotfix deploys, capture a second pass of artefacts using browser screenshots and DOM inspector excerpts from the deployed bundle. The local-preview artefacts above demonstrate the code paths function correctly; staging artefacts will demonstrate they ship correctly.
