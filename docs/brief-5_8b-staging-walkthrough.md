# Brief 5.8B — staging walkthrough evidence

**Deploy:** the most recent Netlify build from `staging` that contains the
Brief 5.8B merge stack (D0-D8 + Polish + R1-R7 review-pass fixes). The
walker should record the actual deploy SHA on the sign-off line at the
foot of this doc — *not* embedded in this preamble (every previous
revision drifted as soon as the next merge landed; see the drift-proof
note in `brief-5_8b-final-review.md`).
**Target URL:** the staging Netlify deploy URL. Use a debug bundle that
exercises a needs_work tier, low top-driver confidence, ≥1 sensitive factor
(rank_flip_rate ≥ 0.15), ≥1 fragile edge, dominant factor at ≥0.8 influence.
**Viewport:** 1280×900.
**Status:** **PARTIALLY CLOSED-OUT.** SPEC + LOG artefacts populated from
local vitest output (123 cases, 0 failures — see "SPEC artefacts" section
below). SS / DOM artefacts pending Paul's capture against the deployed
staging bundle — each acceptance check below tags exactly which slot is
outstanding. The sign-off line at the foot of this doc remains unstamped
until SS / DOM are captured.

## How to capture evidence

Per `AGENTS.md`: every acceptance check below records one runtime artefact — a screenshot, DOM-selection excerpt, interaction-log line, or console assertion. Code-level + green-test evidence is necessary but not sufficient.

Sentinel artefact types used below:

  - **SS** — screenshot (paste image link or markdown reference)
  - **DOM** — DOM selection excerpt (paste HTML snippet from DevTools)
  - **LOG** — interaction-log line / console assertion output
  - **SPEC** — vitest assertion that already proves the contract (cite test ID)

## Acceptance checks

### D0 — Pre-analysis polish (5.8A leftovers)

#### 0.1 No orphan "Ready to analyse" StatusBanner above T1
- **Expected:** Pre-analysis renders T1 directly; no `[data-testid="status-banner"]` orphan above the unified card in the non-failed state.
- **SPEC:** `D0PreAnalysisPolish.spec.tsx → "suppresses the legacy orphan StatusBanner above T1 in non-failed states"`.
- **SS / DOM (Pending Paul):** attach pre-analysis screenshot in non-failed state, plus DevTools search showing 0 matches for `[data-testid="status-banner"]`.

#### 0.2 Narrative bridge: discrete failing-check row, no "before running" prose
- **Expected:** The bridge renders as a discrete failing-check row above + `"{N} unverified estimates and {M} relationships worth reviewing."` + `"Ranked by priority"`. No "before running" anti-pattern.
- **SPEC:** `D0PreAnalysisPolish.spec.tsx`.
- **SS (Pending Paul):** attach screenshot of pre-analysis bridge area.

#### 0.3 OptionPreview collapsed list: one option per line, no concatenation
- **SPEC:** `D0PreAnalysisPolish.spec.tsx`.
- **SS (Pending Paul):** collapsed OptionPreview screenshot.

#### 0.4 Single Explore chip on options card
- **SPEC:** `D0PreAnalysisPolish.spec.tsx`.
- **DOM (Pending Paul):** DevTools query for chips inside the options card returning the surviving "Explore other strategies" only.

#### 0.5 Sharpen-your-thinking accordion shows preview line when collapsed
- **SS (Pending Paul):** collapsed Sharpen accordion with the preview line visible.

---

### D2a — Post T1 hero

#### 2a.1 Heading reads "Decision confidence" (renamed from legacy literal)
- **Expected:** Hero card title renders `"Decision confidence"`. Legacy literal does not appear anywhere on the page.
- **SPEC:** `DecisionConfidencePanel.polishD4.spec.tsx → "hero heading reads 'Decision confidence' (renamed from the legacy literal)"`.
- **DOM / SS (Pending Paul):** attach DOM excerpt of `[data-testid="confidence-health-header"]` containing the new title.

#### 2a.2 Stability indicator beside ring; suppressed when null
- **Expected:** Ring + caption + adjacent `"Stability: NN%"` + thin 3 px bar with evaluative colour. When `recommendation_stability` is missing, the indicator is absent (no "Stability: NaN%").
- **SPEC:** `DecisionConfidencePanel.heroD2a.spec.tsx`.
- **SS (Pending Paul):** two screenshots — bundle with stability present, bundle without.

#### 2a.3 HeroQualifier renders only when lowest dim < 0.7
- **SPEC:** `HeroQualifier.spec.tsx` + `DecisionConfidencePanel.heroD2a.spec.tsx`.
- **SS (Pending Paul):** qualifier visible in a low-evidence bundle, absent in a healthy bundle.

#### 2a.4 3 readiness dimension bars: Evidence / Robustness / Framing
- **Expected:** Bars render keyed off `coachingReadinessDimensions = {evidence, robustness, clarity}`. Wireframe's 4-dim set is intentionally not invented (data audit per Paul).
- **SPEC:** `DecisionConfidencePanel.heroD2a.spec.tsx`.
- **DOM (Pending Paul):** DevTools snippet of the 3 `<DimensionBar>` rows under the hero.

---

### D2b — Post T1 unified triage queue + strengthen overlay

#### 2b.1 Single EVPI-ranked queue (no split sub-headers)
- **Expected:** `[data-testid="unified-triage-queue"]` exists; first card has `[data-testid="unified-triage-emphasised"]` + `border-info/40 bg-info/[0.02]`. No "Highest-value evidence gaps" or "Suggested next actions" sub-header in the DOM.
- **SPEC:** `DecisionConfidencePanel.unifiedQueueD2b.spec.tsx` (11 cases).
- **SS / DOM (Pending Paul):** queue screenshot + DevTools search confirming neither legacy sub-header is present.

#### 2b.2 Stability narrative above queue
- **Expected:** `"Stability: N%. These items would most improve confidence:"` + `"Ranked by evidence value"`. Suppresses on empty queue; drops the percent prefix when stability is missing (no "NaN").
- **SPEC:** same file.
- **SS (Pending Paul):** narrative line above the queue.

#### 2b.3 Strengthen overlay applied via canvas-store `draftCoaching.strengthenItems`
- **Expected:** When a `strengthen_item` label matches a triage card title (case-insensitive trim), `detail` overlays as the card subtitle and `actionType` becomes a passive pill.
- **SPEC:** `DecisionConfidencePanel.unifiedQueueD2b.spec.tsx → "overlays strengthen_items.detail as subtitle and actionType as a passive label when label matches"`.
- **SS (Pending Paul):** post-analysis card with overlay visible.

#### 2b.4 Items 4-6 use compact `.qf` rows under "Also consider"
- **SPEC:** Compact variant assertion in `unifiedQueueD2b.spec.tsx`.
- **SS (Pending Paul):** expanded "Also consider" disclosure with compact rows.

---

### D2c — Post T1 flip-risk + dominant nudge + checks footer

#### 2c.1 Flip-risk callout inside T1 card; copy preserved
- **SPEC:** `DecisionConfidencePanel.t1D2c.spec.tsx`.
- **SS (Pending Paul):** flip-risk callout area on a fragile bundle.

#### 2c.2 Dominant-factor nudge as inline single-line `.nudge` row
- **Expected:** Single line: warning icon + bolded "Dominant factor:" + truncated detail + Validate + Research chips. Long form via `title` tooltip + `aria-label`. NOT a multi-line card.
- **SPEC:** `DecisionConfidencePanel.polishD4.spec.tsx → "Dominant nudge — compressed to inline .nudge row"` (all sub-cases).
- **SS (Pending Paul):** nudge row at 1280 px width — must fit on one line.

#### 2c.3 T1 checks footer (Winner / Robust / Evidence gaps + addressed counter + MissingKnowledgePrompt)
- **SPEC:** `DecisionConfidencePanel.t1D2c.spec.tsx`.
- **SS (Pending Paul):** checks footer at the bottom of the T1 card.

#### 2c.4 Single MissingKnowledgePrompt instance
- **Expected:** Exactly one `[data-testid="missing-knowledge-prompt"]` in the post-analysis panel; lives inside `[data-testid="t1-checks-footer"]`.
- **SPEC:** `DecisionConfidencePanel.polishD4.spec.tsx → "renders exactly one MissingKnowledgePrompt instance"`.
- **DOM (Pending Paul):** DevTools query showing exactly 1 match.

---

### D3 — Your options polish

#### 3.1 Winner card: `border-success/30`; non-winner: `border-panel-border` (palette simplified)
- **SPEC:** `OptionCards.spec.tsx` + `visualContracts.spec.tsx`.
- **SS (Pending Paul):** options card panel showing winner border treatment.

#### 3.2 "What if I tried a different approach?" link at bottom routes to chat
- **SPEC:** `OptionCards.spec.tsx → "Brief 5.8B D3 — different approach link"` (2 cases).
- **LOG (Pending Paul):** click event log showing `onSendMessage` payload.

#### 3.3 Risk-appetite filter ("Show winner by") inside Your options card
- **SS (Pending Paul):** filter visible in Your options, absent from Advanced.

---

### D4 — Stress-test accordion

#### 4.1 Accordion title "Stress-test your decision" + counter badge
- **SPEC:** `StressTestSection.spec.tsx → "renders the accordion with title 'Stress-test your decision'"`.
- **SS (Pending Paul):** collapsed accordion with title + count badge visible.

#### 4.2 Preview line: top sensitive factor or fallback
- **Expected:** When at least one factor has `rank_flip_rate ≥ 0.15` → `"Key challenge: {label} dominates. Should its influence be revisited?"`. Otherwise → `"Review your key assumptions"`.
- **SPEC:** `StressTestSection.spec.tsx` (2 preview cases).
- **SS (Pending Paul):** two captures, one per branch.

#### 4.3 Sensitive assumptions subsection — capped at 3, rank_flip_rate ≥ 0.15 gate
- **SPEC:** `StressTestSection.spec.tsx`.
- **SS (Pending Paul):** expanded subsection with max 3 cards.

#### 4.4 Disconfirmation context line gated on `factor_sensitivity[i].confidence < 0.5`
- **Expected (low):** `"What could make you switch your recommendation from Option A to Option B?"` + `"The analysis depends on {topDriver}, which has limited evidence."` + chip `"Explore this challenge"`.
- **Expected (high):** Question + chip only — NO context line.
- **SPEC:** `stressTestTemplates.spec.ts` (template purity) + `StressTestSection.spec.tsx` (component) + `StressTestSection.factorSensitivityIntegration.spec.tsx` (end-to-end data flow from `report.factor_sensitivity[i].confidence` → `DriverItem.confidence` → context line).
- **SS (Pending Paul):** expanded Disconfirmation card on a low-confidence top-driver bundle.

#### 4.5 Outside view card uses approved copy
- **Expected:** `"For decisions like this, does Option A usually outperform Option B?"` + `"Outside views often catch assumptions you have stopped questioning."` + chip `"Research this"`.
- **SPEC:** `stressTestTemplates.spec.ts` + `StressTestSection.spec.tsx`.
- **SS (Pending Paul):** Outside view card screenshot.

#### 4.6 Fragile factors subsection — verbatim 5.7 D11 alt-winner grouping
- **SPEC:** `StressTestSection.spec.tsx → "renders the 5.7 D11 alt-winner grouping when fragile edges are present"`.
- **SS (Pending Paul):** Fragile factors subsection with grouped alt-winner card.

#### 4.7 Empty-state copy reads "No sensitivity or fragility signals fired" (not "No stress-test signals fired")
- **Expected:** When no sensitive + no fragile, the fallback line is `"No sensitivity or fragility signals fired. Your model is currently consistent."` (the two Thinking-pattern cards remain visible above it).
- **SPEC:** `StressTestSection.spec.tsx → "Empty state"` cases.
- **SS (Pending Paul):** accordion expanded on a clean bundle.

---

### D5 — Drivers demotion

#### 5.1 Drivers section is collapsed by default
- **SS (Pending Paul):** post-analysis on first load showing the collapsed accordion.

#### 5.2 "Ranking may shift {N}%" visible row when `rankFlipRate ≥ 0.15`
- **SPEC:** `DriversSection.rankFlipD5.spec.tsx`.
- **SS (Pending Paul):** expanded driver row with the warning line visible.

---

### D6 — Advanced metadata under expert mode

#### 6.1 Analysis-details block renders only when `expertMode === true`
- **SPEC:** existing `AdvancedSection.spec.tsx` (19 cases).
- **DOM (Pending Paul):** DevTools query showing `[data-testid="advanced-hash-row"]` present with expertMode on, absent off.

---

### D7 — Expert toggle

#### 7.1 Toggle persists across reload via `localStorage.olumi.expertMode`
- **SPEC:** `OutputsDock.expertModeD7.spec.tsx` (5 cases — lazy hydration, on/off persistence, multi-flip).
- **LOG (Pending Paul):** DevTools Application → LocalStorage showing `olumi.expertMode = "true"` after toggling on, then surviving reload.

---

### D8 — Footer re-skin

#### 8.1 Stability bands deterministic (≥0.85 / ≥0.60 / <0.60 / missing)
- **SPEC:** `postAnalysisFooter.spec.ts` (10 cases).
- **SS (Pending Paul):** three captures, one per band.

#### 8.2 Meta line `"{N}% stability · Evidence strong/Evidence gaps remain"` or null
- **SPEC:** same file.
- **SS (Pending Paul):** footer with meta visible.

#### 8.3 Legacy ResultsFooter not rendered
- **DOM (Pending Paul):** DevTools confirms no legacy "Stability sensitive · 62 % of influence" text in the post-analysis panel.

---

### Polish — orphan SHA hash gating

#### 9.1 `dev-build-marker` absent by default
- **Expected:** No SHA hash visible in the panel for a non-expert user, even on dev/staging builds.
- **SPEC:** `ResultsBody.devBuildMarkerD4.spec.tsx → "suppresses the marker when isDev is true but expertMode is false"`.
- **SS (Pending Paul):** full-page capture of post-analysis with expert OFF showing no `45fbb4a`-style hash.

#### 9.2 `dev-build-marker` reappears under `DEV && expertMode`
- **SPEC:** `ResultsBody.devBuildMarkerD4.spec.tsx → "renders the SHA only when both isDev AND expertMode are true"`.
- **SS (Pending Paul):** capture after toggling expert ON in a dev/staging deploy.

---

## SPEC artefacts (already populated)

Every SPEC tag on the acceptance checks above is backed by a green vitest
assertion captured during the R6 walkthrough run. The full set of
brief-5.8B SPEC files (15 files, **123 cases, 0 failures**) was executed
locally on the R6 working tree:

```
$ pnpm exec vitest run \
    src/components/results/__tests__/HeroQualifier.spec.tsx \
    src/components/results/__tests__/DecisionConfidencePanel.heroD2a.spec.tsx \
    src/components/results/__tests__/DecisionConfidencePanel.t1Structure.spec.tsx \
    src/components/results/__tests__/DecisionConfidencePanel.t1D2c.spec.tsx \
    src/components/results/__tests__/DecisionConfidencePanel.unifiedQueueD2b.spec.tsx \
    src/components/results/__tests__/DecisionConfidencePanel.polishD4.spec.tsx \
    src/components/results/__tests__/StressTestSection.spec.tsx \
    src/components/results/__tests__/StressTestSection.factorSensitivityIntegration.spec.tsx \
    src/components/results/utils/__tests__/stressTestTemplates.spec.ts \
    src/components/results/__tests__/DriversSection.rankFlipD5.spec.tsx \
    src/components/results/__tests__/AdvancedSection.spec.tsx \
    src/canvas/components/__tests__/OutputsDock.expertModeD7.spec.tsx \
    src/canvas/components/utils/__tests__/postAnalysisFooter.spec.ts \
    src/components/results/__tests__/ResultsBody.devBuildMarkerD4.spec.tsx \
    src/components/results/__tests__/ResultsBody.singleMkpD4.spec.tsx
…
 Test Files  15 passed (15)
      Tests  123 passed (123)
```

Counts wider scope:

  - `src/components/results/` + `src/components/shared/` + `src/canvas/components/utils/`: **1109** total (1108 pre-R6 + 1 new full-ResultsBody MKP test).
  - Typecheck (`pnpm run typecheck`): clean.
  - Doc-lint (`bash scripts/doc-lint.sh`): clean (no `<…>` placeholders).

The screenshot / DOM artefact slots in each acceptance check above remain
for Paul to attach against the next staging deploy. Items where SPEC alone
is sufficient (pure-function helpers, accessibility-attribute checks) are
already evidenced.

## Grep gates

Re-run against the deploy bundle (deploy SHA recorded on the sign-off
line below). All must return zero hits except where noted:

```
$ rg "Highest-value evidence gaps" src/components/results/   # 0
$ rg "Suggested next actions" src/components/results/        # 0
$ rg "Before you decide" src/components/results/             # 0
$ rg "Current result" src/components/results/                # 0
$ rg "Review next" src/canvas/components/pre-analysis/       # 0
$ rg "Improve confidence" src/canvas/components/pre-analysis/ # 0
$ rg "as any" src/components/results/                        # 47 — D1 baseline, zero new
```

## Sign-off

Once every check has an artefact, stamp this file with date + walker name at the bottom and commit it. Close-out brief requires evidence per acceptance item.

_walked by: ______________ date: ______________ deploy SHA: ______________
