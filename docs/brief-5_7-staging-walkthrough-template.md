# Brief 5.7 — Staging walkthrough template

For each deliverable: open the canvas, set up the conditions, take the action, capture evidence, sign off.

Tester: ____________________
Date:   ____________________
Branch: `ui/analysis-tab-hotfix-5_7`
Build:  ____________________ (commit short SHA after deployment)

---

## D2 — Model checks card removed

**Setup:** open any decision where the canvas has a top driver with influence ≥ 60% and at least one contested edge (the prior conditions that fired the science-nudge cards). Run the analysis to completion and open the Results panel.

**Expected:**
- The Top evidence triage cards (numbered 1, 2, 3) render.
- The "Your options" section appears immediately after the triage stack (or "Suggested next actions" if Path B fired — see D6).
- **No card with the heading "Model checks"** appears between the triage stack and Your options.
- **No subtitle "Structural signals that may affect the result"** anywhere on the panel.

**Forbidden (regression flags):**
- A standalone factor card under a "Model checks" heading reappearing.
- The "Lightbulb / Validate / Research" pill card pattern reappearing in the Results panel.

**Evidence:**
- [ ] Screenshot of Results panel — Top evidence to Your options scroll
- [ ] DOM inspector confirms no element with `title="Model checks"` or matching subtitle copy

**Sign-off:** ____________________

---

## D3 — Validate chip on dominant-factor warning

**Setup:** find or build a decision graph where one factor has ≥ 80% influence after analysis. The "Your result depends heavily on one factor" warning fires above the driver list.

**Expected:**
- The warning card renders with the factor name, "drives N% of the outcome" copy.
- **Both** Validate and Research chips render.
- Clicking Validate selects/focuses the factor on the canvas (graph view).

**Forbidden:**
- Only Research rendering (the staging-pre-fix state).
- Validate chip throwing on click when CEE has not populated `dominantFactorId`.

**Evidence:**
- [ ] Screenshot showing Validate + Research chips together
- [ ] Click Validate → canvas focuses the factor node
- [ ] DOM inspector confirms `aria-label="Validate <factor name> on canvas"` on the chip

**Sign-off:** ____________________

---

## D4 — Confidence bar in driver rows

**Setup:** any decision with at least three drivers post-analysis. Open Results → "What's driving this".

**Expected:**
- Each driver row's confidence column shows a **single thin horizontal bar** plus a numeric percentage (e.g. "60%").
- The bar is **blue** (`bg-info`) and visibly thinner than the green/orange sensitivity bar to its left.
- Empty / missing-confidence rows show "-" (dash placeholder, unchanged).
- Hovering the bar surfaces the tooltip; clicking it focuses the factor on the canvas.

**Forbidden:**
- A 4-dot indicator reappearing.
- The confidence bar using the same green/warning palette as sensitivity (would re-create the vocabulary collision Brief 5.5 D7 was solving for).

**Evidence:**
- [ ] Screenshot of three driver rows showing thin blue bar + numeric readout
- [ ] DOM inspector: confidence track element has classes `h-1 bg-panel-hover rounded-full`; fill child has `bg-info` and inline `width: NN%`

**Sign-off:** ____________________

---

## D5 — Authority bias filter

**Setup:** find or stage two CEE responses:
1. A bundle where CEE returns an `AUTHORITY_BIAS` finding **without** `target_factor_id`.
2. A bundle where CEE returns an `AUTHORITY_BIAS` finding **with** `target_factor_id` populated.

Open the Pre-analysis panel after each.

**Expected for case 1 (no target):**
- The "Authority bias" card is **absent** from both Start here and Review next.
- No card with the copy "Watch for this bias when reviewing the items below" anywhere on the panel.

**Expected for case 2 (with target):**
- The bias card renders. The body copy is the trigger's actual explanation (e.g. "The opinions of senior stakeholders may anchor your estimate of …"), not the generic meta-commentary.

**Expected for other bias kinds (NARROW_FRAMING, CONFIRMATION_BIAS, sunk_cost, …):** unchanged behaviour — they still render even without `target_factor_id`.

**Forbidden:**
- Generic "Watch for this bias…" copy appearing for ANY bias kind.
- Other bias kinds being suppressed when their `target_factor_id` is empty.

**Evidence:**
- [ ] Case 1 — screenshot showing Pre-analysis panel without an authority-bias card
- [ ] Case 2 — screenshot showing the card with target-naming copy
- [ ] Case 3 — confirmation that NARROW_FRAMING / other kinds still render

**Sign-off:** ____________________

---

## D6 — Top evidence split (Path B)

**Setup:** find or stage a CEE result where:
1. `topEvidenceGaps` has 2 entries with high VOI.
2. `topNextActions` has at least 1 entry.

Open Results → Top evidence section.

**Expected:**
- Two cards appear under the existing "Highest-value evidence gaps" header. Each carries: numbered badge (1, 2), title, AI-estimate pill, progress bar with percentage, pp pill, coaching text, **Set value** input, More disclosure.
- A new subheader "Suggested next actions" appears below the gap cards.
- One card appears under that subheader, carrying: numbered badge (3), title, coaching text, edit pencil. **No** progress bar, **no** pp pill, **no** Set-value input.
- Numbering continues across the boundary: gap cards 1, 2; next-action card 3.

**Forbidden:**
- Three cards under one heading with inconsistent structure (the staging-pre-fix state).
- Card 3 rendering with empty placeholder slots ("N/A", greyed-out percentages, etc.) — Path A was rejected for exactly this reason.

**Evidence:**
- [ ] Screenshot showing the two-section split with continued ordinals
- [ ] DOM inspector: `[data-testid="evidence-gap-cards"]` contains 2 triage cards; `[data-testid="next-action-cards"]` contains 1 triage card and a `[data-testid="next-actions-section-header"]`

**Sign-off:** ____________________

---

## D7 — Confirm action on AI-estimated factors

**Setup:** find or stage a decision where Pre-analysis Improve confidence renders triage cards for AI-estimated factors (subgroup `cee_inference`) AND missing-data factors.

**Expected:**
- AI-estimated factors render a **Confirm** action (green Check icon, tooltip "Confirm AI estimate").
- Set value input is also visible (inline editor) on the same card.
- Clicking Confirm marks the factor's source as `user_confirmed` in the canvas store; the resolved-signals undo banner appears.
- Missing-data factors continue to render the **Set value** action and inline editor (unchanged).

**Forbidden:**
- AI-estimated factors rendering inert (no Confirm chip, no inline editor) — the staging-pre-fix state.

**Evidence:**
- [ ] Screenshot of an AI-estimated triage card showing Confirm chip + inline editor
- [ ] Click Confirm → factor source becomes `user_confirmed` (verify via canvas inspector or graph store snapshot)
- [ ] Missing-data card continues to behave as before

**Sign-off:** ____________________

---

## Cross-cutting acceptance

- [ ] Typecheck passes: `npm run typecheck`
- [ ] Scoped vitest passes: `npx vitest run src/components/results src/canvas/components/pre-analysis` (target: ≥ 1542 passes, 13 skipped, 0 failed)
- [ ] Brief 5.7 D8 grep gates: zero hits across all three
- [ ] Brief 5.5 §2.8 gates: zero or documented
- [ ] Brief 5.6 §2.6 gates: conform per `docs/brief-5_7-final-review.md`

---

## Final sign-off

QA: ____________________  Date: __________
Owner: __________________  Date: __________
