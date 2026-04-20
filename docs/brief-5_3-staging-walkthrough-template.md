# Brief 5.3 — staging walkthrough evidence template

**Branch:** `claude/laughing-archimedes-a0a42d`
**Viewport:** 1280 × 900
**Panel:** Pre-analysis panel (Analysis tab, before running analysis)

## How to capture evidence

For each acceptance check below, record one runtime artefact — a screenshot, a DOM selection excerpt, or an interaction log. Paste under the check. Don't mark a check ✅ without an artefact.

## Acceptance checks

### 1. Blocker card — critical (danger border, AlertTriangle icon)

- **Setup:** Load a session with a `MISSING_BASELINE` or `OPTIONS_NOT_SET` blocker present.
- **Expected:** Card renders with `border-danger/30` left treatment, red `AlertTriangle` icon, title in `text-danger`, description in `text-text-body`. Horizontal padding is 16 px (`px-4`). No filled/tinted background.
- **Forbidden:** `border-danger` (fully opaque border), `bg-danger-light` or any tinted background, `text-sm font-medium` raw utilities on the title.
- **Evidence:** _screenshot of a critical blocker card at 1280 px_

### 2. Blocker card — warning (warning border, AlertTriangle icon)

- **Setup:** Load a session with a warning-severity blocker (e.g. `WEAK_EVIDENCE`).
- **Expected:** Card renders with `border-warning/30` treatment, amber `AlertTriangle` icon, title in `text-warning`. Padding and background same as check 1.
- **Forbidden:** Same as check 1.
- **Evidence:** _screenshot of a warning blocker card_

### 3. Retry Draft / Edit brief button — panelBody size

- **Setup:** Trigger a draft error so the "Retry Draft" or "Edit brief" action button appears inside a blocker card.
- **Expected:** Button text is `panelBody` weight (not `panelMeta`). Border-pill shape with `border-info/40` outline. Hover transitions to `border-success/40 text-success`.
- **Forbidden:** `panelMeta`-weight button text (visually thinner than surrounding body copy).
- **Evidence:** _screenshot of the button, or DevTools computed font-size / font-weight on the button element_

### 4. Readiness copy absent in fully-ready state

- **Setup:** Load a fully-ready graph (StatusBanner shows "Ready to run").
- **Expected:** No secondary "Ready to run." headline appears below the StatusBanner inside the pre-analysis panel. The StatusBanner owns that state alone.
- **Forbidden:** `"Ready to run. N checks passed."` or `"Ready to run."` appearing as a panel headline below the banner.
- **Evidence:** _screenshot of the pre-analysis panel in the ready state_

### 5. Review next — scope subtitle present

- **Expected:** The "Review next" section header shows a subtitle `"Highest-impact checks for your specific decision"` in `panelMeta text-text-light` below the title row.
- **Evidence:** _screenshot of the Review next header with subtitle visible_

### 6. Improve confidence — scope subtitle present

- **Expected:** The "Improve confidence" accordion header shows a subtitle `"Lower-impact checks — address these after Review next"` rendered below the `<h3>` title.
- **Evidence:** _screenshot of the Improve confidence header with subtitle visible_

### 7. Your options — factor overlap labels in collapsed state

- **Setup:** Load a session with 2+ non-baseline options that share at least one factor intervention (i.e. `hasSameLeversCheck` fires).
- **Expected:** Collapsed state shows `"All options route through [Factor A], [Factor B]."` in `panelMeta text-text-light` above the narrow-framing coaching line.
- **Forbidden:** Overlap copy appearing in the expanded state (it renders in collapsed state only).
- **Evidence:** _screenshot of collapsed Your options with the overlap line visible_

### 8. Review next badge — info colour; Improve confidence badge — factor colour

- **Expected:** Ordinal badges on Review next triage cards use `bg-info` background. Ordinal badges on Improve confidence triage cards use `bg-factor` (purple). Badge text uses `text-text-on-color`.
- **Forbidden:** Both sections using the same badge colour; `text-white` on any badge.
- **Evidence:** _screenshot showing at least one badge from each section side-by-side, or DevTools background-color assertion on both_

### 9. Card padding — 16 px horizontal on all pre-analysis cards

- **Expected:** All pre-analysis cards (blocker cards, triage cards, info cards, MissingKnowledgePrompt) have 16 px horizontal padding. Triage card list gap is 8 px between rows.
- **Evidence:** _DevTools box-model readout on one blocker card and one triage card showing padding-left: 16 px_

### 10. "Something missing" card — helper copy + dismiss tooltip

- **Expected:** Card shows two text lines: `"Something missing from the model?"` (panelBody) and `"Describe what's missing and Olumi will suggest where it fits in your model."` (panelMeta). Hovering the ✕ button shows a `"Dismiss"` tooltip. Tab-focusing the ✕ shows a `focus-visible` ring.
- **Evidence:** _screenshot of the card at rest showing both lines; a second screenshot with the tooltip visible on the ✕_

### 11. ModelAdjustments absent from pre-analysis panel

- **Setup:** Load a session where CEE returned `model_adjustments` (Wrench icon was previously visible pre-analysis).
- **Expected:** No Wrench icon or "Olumi adjusted N factors" section in the pre-analysis panel.
- **Forbidden:** `data-testid="model-adjustments"` present in the DOM when the pre-analysis panel is visible.
- **Evidence:** _DevTools Elements search for `[data-testid="model-adjustments"]` returning 0 results while pre-analysis panel is open_

## Sign-off

Once every check has an artefact, stamp this file with date + walker name at the bottom and commit it.

_walked by: ______________ date: ______________ branch: claude/laughing-archimedes-a0a42d_
