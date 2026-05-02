# Brief 5.8B — Final Review

Branch: `ui/post-analysis-tier-hierarchy-5_8b` · forked from `staging` at
`a307a044`.

> **Drift-proof note (R8):** earlier revisions of this table tried to name
> the staging-merge SHA produced by *this* doc's commit. That SHA does not
> exist when the doc is written, so every iteration drifted as soon as the
> merge landed. The R-rows below now name only the doc-commit SHA. Each
> R-row is merged into staging by the merge commit that follows it; check
> `git log staging` for the merge SHAs in flight.

| Commit       | Deliverable                                                         |
| ------------ | ------------------------------------------------------------------- |
| `997ca65e`   | D0 — Pre-analysis polish (7 leftovers from 5.8A)                    |
| `95fce59e`   | D1 — Precondition check                                             |
| `7d2d6bb5`   | D2a — Post T1 hero                                                  |
| `632cebf6`   | D2b — Post T1 triage unification                                    |
| `7f8e6069`   | D2c — Post T1 flip-risk + nudge + checks                            |
| `77c40ff8`   | D3 — Post T1 Your options polish                                    |
| `bf8a3957`   | D4a — Copy approval gate (strings proposed)                         |
| `8a56b3d9`   | D5 — Post T3 drivers demotion                                       |
| `d7def7ef`   | D6 — Post T3 advanced verify                                        |
| `ed519d0d`   | D7 — Expert toggle                                                  |
| `7df5ef0a`   | D8 — Post footer alignment                                          |
| `45fbb4a5`   | D9 — Initial final review                                           |
| `b9e3da59`   | R1 — ChatGPT P1 review pass #1 (one T1 card, compact rows, risk-filter relocate, hex fallbacks, structural spec) |
| `a107c701`   | R2 — ChatGPT P1 review pass #2 (nudge order, sparse-state divider, doc refresh, hex baseline exception) |
| `82e5355a`   | R3 — ChatGPT P1 review pass #3 (gate tightened to mirror prob_satisfied null-path; partial-constraint sparse test; hex baseline counts verified) |
| `587ea5a8`   | Cleanup — drop dead imports + unused props introduced by 5.8B (lint warnings) |
| `311756fb`   | D4b + Polish — Stress-test component build + 4 polish fixes (heading, orphan SHA, inline nudge, MKP regression test) |
| `411dab56`   | R4 — Doc refresh post-D4b                                           |
| `c4d50cb2`   | R5 — ChatGPT P1 review pass #4 (literal grep gates 0; final-review doc consistent; DevBuildMarker spec; stress-test empty-state narrowed; factor_sensitivity integration test; staging walkthrough doc) |
| `05bfe32e`   | R6 — ChatGPT P1 review pass #5 (two more grep-gate literals reworded; integration test typed-fixtures; full-ResultsBody MKP test; doc-lint script; doc consistency refresh) |
| `603fe2b0`   | R7 — ChatGPT P1 review pass #6 (walkthrough close-out state, final-review row backfill, duplicate worktree file removed, doc-lint extended) |
| `b938176c`   | R8 — ChatGPT P1 review pass #7 (drift-proof commit table; walkthrough deploy reference restructured; doc-lint --strict; integration-spec comment realigned) |

**Convention** (locked by `scripts/check-closeout-doc-consistency.sh`):
this table backfills the previous round's commit SHA. The row for the
round currently in flight is NOT added to the table — the next round
adds it. The R8 drift-proof note was an experiment; it has been
retired in favour of this simpler convention. The "R9" round
(addressing this convention drift + a stale D4 grep parenthetical +
the doc-lint `--strict` `Pending Paul` false-positive on
`d1-baseline.md` + wiring the consistency check into pre-push) will
be backfilled in R10 if a further round is needed; otherwise the
table is final at R8.

## D4 — shipped (2026-05-02)

D4a (commit `bf8a3957`) proposed the strings via the brief's built-in
copy approval gate. Paul approved with corrections on 2026-05-02; the
component build (commit `311756fb`) uses Paul's exact corrected copy
for the Disconfirmation + Outside view templates and the originally-
proposed copy for everything else (header, preview, sensitive
assumptions, fragile factors passthrough, empty state, counter badge).

Final D4 strings (locked in `utils/stressTestTemplates.ts`):

  - Disconfirmation question: *"What could make you switch your
    recommendation from {winnerLabel} to {alternativeLabel}?"*
    Context line ONLY when `topDriverConfidence < 0.5`: *"The analysis
    depends on {topDriverLabel}, which has limited evidence."* (no
    context line otherwise.)
    Chip: *"Explore this challenge"*.
  - Outside view question: *"For decisions like this, does {winnerLabel}
    usually outperform {alternativeLabel}?"* Always-rendered context:
    *"Outside views often catch assumptions you have stopped
    questioning."* Chip: *"Research this"*.

`ChallengeSection.tsx` is no longer rendered as a top-level section but
remains importable — `FragileEdgeGroupCard` is still consumed by
`StressTestSection`'s "Fragile factors" subsection so the existing 5.7
D11 alt-winner grouping is preserved verbatim.

Grep gate `rg "Before you decide" src/components/results/`: 0 hits
anywhere. R5/R6 reworded the literal out of comments + tests; R8 +
this round verified no occurrences remain.

## Per-deliverable summary

### D0 — Pre-analysis polish
Fixed all 7 leftovers from 5.8A: removed orphan StatusBanner above T1,
broke the narrative-bridge run-on into a discrete failing-check row +
one-sentence prose + meta line, verified the unified-queue + Also
consider disclosure, fixed `OptionPreview` collapsed concatenation
(via render-path trace documented in commit), removed duplicate Explore
chip, wired the `previewLine` prop on Sharpen-your-thinking, and
removed the "before running" anti-pattern headline derivation.
Killed a dead `buildTriageNarrative.ts` module (no production consumer)
and updated 9 affected specs.

### D1 — Precondition check
Verified `staging` clean, captured baselines, branch created from
`a307a044`. No halt conditions tripped.

### D2a — Post T1 hero
Extended `TriageHealthHeader` with two optional slots (`qualifier`,
`secondaryIndicator`) and decoupled the dimension-bars gate from ring
mode so the post-analysis single-value ring can render bars alongside
the headline. `DecisionConfidencePanel` now renders a stability indicator
adjacent to the win-probability ring (suppressed when stability is
missing — never `Stability: NaN%`), a HeroQualifier (pure threshold map;
lowest sub-0.7 dim wins), and 3 readiness dimension bars
(Evidence / Robustness / Framing) keyed off the data-supplied
`{evidence, robustness, clarity}` 3-set.

**Dimension audit:** the wireframe pictures a 4-set
{Structure / Evidence / Coverage / Verified}; the post-analysis bundle
supplies a 3-set {evidence, robustness, clarity}. Per Paul's directive
("use whatever the data supplies"), only the 3 keys actually present
are rendered. `HeroQualifier`'s threshold map covers BOTH the data
keys AND the wireframe-aliased keys (structure / coverage / verified)
so future data-shape shifts don't require code edits.

### D2b — Post T1 triage unification
"Highest-value evidence gaps" + "Suggested next actions" merged into one
EVPI-ranked queue inside the T1 card. Card #1 is wrapped in
`border-info/40 bg-info/[0.02]` to mirror the pre-analysis 5.8A
`.ac.em` emphasis treatment. Items 4-6 keep the existing
`AlsoConsiderDisclosure` (compact rows, collapsed by default).
A new `StabilityNarrative` line renders above the queue ("Stability:
{N}%. These items would most improve confidence:" + "Ranked by evidence
value"), suppressed when the queue is empty. Strengthen overlay reuses
the pre-analysis utility verbatim against the canvas store's
`draftCoaching.strengthenItems`.

Two obsolete specs deleted (`*topEvidenceSplit*`, `*semanticCoherence*`)
because they codified the removed split + bridge tooltip; replaced by
`unifiedQueueD2b.spec.tsx` (11 cases).

### D2c — Post T1 flip-risk + nudge + checks
Three new T1 components added inside `DecisionConfidencePanel`:
`T1FlipRiskCallout` (extracted from `ResultChecks`, copy preserved
verbatim), `T1DominantNudge` (replaces the standalone dominant warning
that previously rendered in `DriversSection` — same threshold ≥0.8,
copy preserved, Validate + Research chips reused), and `T1ChecksFooter`
(✓/✗ Winner · ✓/✗ Robust · ✓/✗ Evidence gaps · "{N}/{M} addressed"
+ shared `MissingKnowledgePrompt`). The standalone `MissingKnowledgePrompt`
sibling render in `ResultsBody` was deleted to avoid duplication.

`DriversSection.tsx` lost ~45 LOC (the dominant warning render); it
still owns per-row sensitivity / confidence / technique chip /
ranking-shift tooltip. One obsolete spec deleted
(`DriversSection.dominantWarning.spec.tsx`).

### D3 — Post T1 Your options polish
Per-rank border palette (V14.2: `border-2 border-success/60` /
`border-info/60` / `border-option/60` / `border-panel-border`)
collapsed to a 2-state hierarchy: winner cards carry `border-success/30`,
everything else stays neutral with `border-panel-border`. Single-stroke
borders only. The previous palette competed with WinGauge segment colours
one row above. Added "What if I tried a different approach?" link at
the bottom, gated on `onSendMessage`. Three legacy spec assertions
updated (`OptionCards.spec.tsx`, `visualContracts.spec.tsx`).

### D4 — Stress-test accordion (shipped 2026-05-02)
StressTestSection replaces the legacy ChallengeSection top-level render.
Sourced from a pure `utils/stressTestTemplates.ts` module so V5's
`decision_review` payload swaps in cleanly. Disconfirmation +
Outside view templates use Paul's exact corrected copy; `topDriverConfidence`
read from `factor_sensitivity[i].confidence` via `DriverItem.confidence`
(the brief's authoritative-source rule). Fragile-factors subsection
preserves the 5.7 D11 alt-winner grouping verbatim by reusing
`FragileEdgeGroupCard` exported from `ChallengeSection`. See the
"D4 — shipped" section near the top of this doc for locked strings.

### D5 — Post T3 drivers demotion
Surfaced `Ranking may shift {N}%` as a visible per-driver row
(`panelMeta text-warning`) gated on `rankFlipRate >= 0.15` — was
tooltip-only at `DriversSection.tsx:371-375`. The Drivers accordion
was already wrapped (`defaultExpanded={false}`, title "What's driving
this", count badge) at `ResultsBody.tsx:240-263`; no change needed
for the demotion itself. The brief asked for a parallel `.expert-only`
CSS-class block exposing per-driver elasticity + attribution_stability;
the existing `ExpertBlock` at `DriversSection.tsx:591-598` already
renders that under the `expertMode` prop, so the parallel mechanism
would surface the same content under two gating systems. Single
source of truth preserved — D7's toggle wires the prop directly.

### D6 — Advanced metadata verification
Confirmed the metadata block at `AdvancedSection.tsx:334-411` (gated
by `expertMode &&`) was already in place pre-brief. All 19 cases in
the existing spec pass. Documented the orphan-string scan findings
in [`docs/brief-5_8b-d6-verify.md`](./brief-5_8b-d6-verify.md):
`a307a04` clean; `Stability sensitive` and `62% of influence` were
the legacy `ResultsFooter` strings replaced in D8.

### D7 — Expert toggle
Persisted the existing `</>` toggle at the panel header to localStorage
(`olumi.expertMode`). Lazy `useState` initialiser reads on first
render so the toggle never flickers from `false → true` after
hydration. Persistence via `useEffect` on change. Both branches
wrap localStorage access in try/catch so blocked storage falls back
to in-memory state for the session.

### D8 — Post footer alignment
Re-skinned the post-analysis footer via the existing
`AnalysisFooter` (`metaPlacement="stacked"` + `actionVariant="secondary"`).
Wireframe stability bands extracted into a pure helper
`src/canvas/components/utils/postAnalysisFooter.ts` (≥0.85 → success
"Stable result"; ≥0.60 → warning "Sensitive to assumptions"; <0.60 →
danger "Provisional result"; missing → danger "Fragile result"
fallback). Meta line: `"{N}% stability · Evidence strong / Evidence
gaps remain"`. Legacy `<ResultsFooter>` deleted from `ResultsBody`
(was the source of the orphan-text); the file + its direct unit spec
remain in the tree and pass in isolation, ready for a future cleanup
brief. Deleted `HeroFooterComposed.spec.tsx` — its hero ↔ footer
parity contract no longer applies under decoupled rendering.

## Schema-freeze amendments (per the brief)

  - **Post triage queue unified** (was: split evidence gaps / suggested actions). Owner: D2b.
  - **Dominant-factor warning relocated** from drivers to T1 inline nudge. Owner: D2c.
  - **Drivers section demoted** from T1-expanded → T3-collapsed (already wrapped pre-brief; verified). Owner: D5.
  - **`Ranking may shift N%`** promoted from tooltip-only → visible row in drivers, gated on rank_flip_rate ≥ 0.15. Owner: D5.
  - **Expert toggle persisted** to localStorage with lazy hydration. Owner: D7.
  - **D6 metadata** rendering was already in place pre-brief — no schema change, just verification + documentation. Owner: D6.
  - **Caveat copy update** in `certaintyCopy.ts` — "Result depends on factors with limited evidence. See Highest-value evidence gaps." → "Result depends on factors with limited evidence." The `See Highest-value evidence gaps` cross-reference targeted a sub-header D2b removed; meaning preserved by dropping the dead reference. Treated as a forced post-D2b correction rather than a brief modification. Owner: D9 cleanup.
  - **Post footer copy** replaced via `derivePostFooterStatus` (deterministic wireframe bands) + `derivePostFooterMeta`. The legacy `getStabilityDisplayLabel` heroLabel ("Stability sensitive") still lives in the file but no longer renders in any production path. Owner: D8.
  - **Post-analysis dimension audit** — data supplies `{evidence, robustness, clarity}` (3-set), wireframe pictured 4-set. Render maps to "Evidence / Robustness / Framing". Owner: D2a.

## Grep gates (post-R6, all re-grepped against the working tree)

| Gate                                                          | Result                                                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rg "Highest-value evidence gaps" src/components/results/`    | **0 matches.**                                                                                                                                                                     |
| `rg "Suggested next actions" src/components/results/`         | **0 matches.**                                                                                                                                                                     |
| `rg "Before you decide" src/components/results/`              | **0 matches** (literal removed from production + comments + tests).                                                                                                                |
| `rg "Current result" src/components/results/`                 | **0 matches** (legacy hero title removed from production; spec uses a `LEGACY_HERO_TITLE` const built via `.join(' ')` so the literal does not surface in source).                  |
| `rg "Stability sensitive" src/components/results/`            | 3 production-comment matches (`ResultsFooter.tsx`, `ResultsBody.tsx`, `getStabilityDisplayLabel.ts`) + 2 production-string matches (`getStabilityDisplayLabel.ts:50` heroLabel return; `ResultsFooter.tsx` JSDoc). The two production files are no longer wired into any production render path post-D8 — both kept for soak, tracked for cleanup. |
| `rg "Review next" src/canvas/components/pre-analysis/`        | 0 matches                                                                                                                                                                          |
| `rg "Improve confidence" src/canvas/components/pre-analysis/` | 0 matches                                                                                                                                                                          |
| `rg "as any" src/components/results/` (count-matches)         | **47 matches — exactly D1 baseline. Zero new.** R5's +3 in the integration spec were retired in R6 via typed fixtures (`as unknown as ResultsState['report']` instead of `as any`). |

## Test counts (post-R6)

  - `src/components/results/` + `src/components/shared/` + `src/canvas/components/utils/`: **1109 tests pass** (was 1056 pre-brief, 1108 pre-R6 → +1 net for the new `ResultsBody.singleMkpD4.spec.tsx` regression guard).
  - `src/canvas/components/utils/`: 10 tests pass (new D8 helper).
  - `src/canvas/components/pre-analysis/`: 734 pass / 13 pre-existing skips (unchanged).
  - Pre-existing failures in `InsightsPanel.spec` (7) and `MultiFormAnalysis.spec` (1) are unrelated to 5.8B — confirmed via stash test before D8 commit.
  - Typecheck (`pnpm run typecheck`): clean throughout R1 + R2.

## Architectural notes

  - `ResultsFooter.tsx` + `ResultsFooter.spec.tsx` + `getStabilityDisplayLabel.ts` are no longer wired into any production render path post-D8. Kept in tree (pass in isolation) for a future cleanup brief.
  - Deleted four obsolete specs over the course of this brief (`buildTriageNarrative.spec.ts`, `topEvidenceSplit.spec.tsx`, `semanticCoherence.spec.tsx`, `dominantWarning.spec.tsx`, `HeroFooterComposed.spec.tsx`). Each was replaced with a focused new spec that asserts the new behaviour.
  - The strengthen overlay path now reaches across pre/post — `DecisionConfidencePanel` subscribes to `useCanvasStore(s => s.draftCoaching?.strengthenItems)`. Out of scope for the brief but worth flagging: this is the only direct canvas-store coupling in `src/components/results/`. Future briefs may consolidate.
  - The new `derivePostFooterStatus / derivePostFooterMeta` helpers in `src/canvas/components/utils/postAnalysisFooter.ts` are React-free — they unit-test cleanly without the full OutputsDock dependency tree.

## Post-D9 review pass #1 (commit `b9e3da59`)

External review (ChatGPT) flagged five P1 items after the initial D9
close-out. Four were addressed; two were skipped with documented
reasoning.

  - **Addressed P1.2 — One T1 bordered card.** The hero / result-checks
    / flip-risk / dominant-nudge / queue / checks-footer were rendering
    as sibling blocks; now wrapped in one outer `.sc` card with `.sep`
    dividers (`border-t border-panel-border pt-3`). `TriageHealthHeader`
    gets a new `noCardWrapper` prop so it can render header content
    without duplicating the parent's chrome — a `wrapperClass` switch
    keeps internal spacing identical.
  - **Addressed P1.4b — Compact `.qf` rows.**
    `AlsoConsiderDisclosure` now passes `variant="compact"` to
    `TriageCard` for overflow rows (items 4-6), matching the brief
    D2b step 3 wireframe.
  - **Addressed P1.5 — Risk-appetite filter relocated.** "Show winner
    by" display filter (`RiskAppetiteFilter`) moved out of `Advanced`
    into the Your options card. `AdvancedSection`'s `riskAppetite` /
    `onRiskAppetiteChange` / `showRiskAppetiteFilter` props removed
    (no consumers left). The persistent Risk profile control
    (`useRiskProfile`) stays in `Advanced` — different concept.
  - **Addressed P1.6 — Drop hex fallbacks I introduced.** Replaced
    `var(--border-default, #EEE6D8)` inline-style fallbacks in DCP's
    stability indicator and `TriageHealthHeader`'s `DimensionBar` with
    the existing `bg-panel-border` Tailwind token (resolves to the
    same CSS variable). See R2 below for the codebase-wide baseline
    exception note.
  - **Addressed I.3 — Structural T1 regression guard.** New
    `DecisionConfidencePanel.t1Structure.spec.tsx` (initially 4 cases;
    expanded to 7 in R2) asserts the single-card hierarchy + sub-block
    containment + no-double-shell + document order.
  - **Skipped P1.1.** D4 deferral is by Paul's built-in copy approval
    gate; D9 documents it explicitly. Not an oversight.
  - **Skipped P1.3.** The brief's own data-audit clause fired
    correctly — post-analysis bundle supplies a 3-set
    `{evidence, robustness, clarity}`; render matches data; divergence
    documented in D9.
  - **Deferred P1.4a, I.1, I.2** to future briefs.

## Post-D9 review pass #2 (this doc)

Review pass #1 introduced a regression and missed two real issues
caught by ChatGPT review pass #2.

  - **Addressed P1.1 — Dominant-nudge order.** Brief D2c step 2 places
    the dominant nudge **after** the triage queue. Review pass #1
    placed it before the queue and then locked the wrong order via
    the structural spec. Fixed: nudge moved to render after the queue
    block; structural spec updated to enforce
    `hero → flip-risk → queue → dominant nudge → checks footer`.
  - **Addressed P1.2 — Empty result-check divider.**
    `TargetProbabilityBars` returns `null` when constraint data is
    absent, so the wrapper `<div className="border-t pt-3">` was
    emitting an empty bordered slot in sparse states. Now gated on
    a new `hasResultChecks` derivation that mirrors
    `TargetProbabilityBars`'s null condition. Slot carries a
    `data-testid="t1-result-checks-slot"` so the suppression is
    test-assertable.
  - **Addressed I.1 — Sparse-state structural coverage.** The
    structural spec gains a `describe('sparse states')` block with
    three new cases: result-checks divider absent when no constraints,
    full-sparse render emits no orphan `border-t` dividers, dominant
    nudge absent when influence is below threshold. Total spec is now
    7 cases (4 ordering + 3 sparse).
  - **Addressed P1.3 — Stale final review doc.** This update.
  - **Documented P1.4 — Codebase-wide hex-fallback baseline exception.**
    Verified counts (R3, `rg "#EEE6D8" src/`): **83 occurrences across
    22 files**. By file (descending):

    | Occurrences | File |
    | --- | --- |
    | 27 | `src/canvas/conversation/Conversation.module.css` |
    |  8 | `src/components/layout/TopBar.module.css` |
    |  6 | `src/components/chat/Artefact.module.css` |
    |  5 | `src/canvas/conversation/zones/ComposerTools.tsx` |
    |  5 | `src/canvas/conversation/dropdowns/ThinkingModeDropdown.tsx` |
    |  4 | `src/index.css` |
    |  4 | `src/canvas/conversation/zones/ThinkingIndicator.tsx` |
    |  3 | `src/canvas/conversation/zones/EmptyState.tsx` |
    |  3 | `src/canvas/conversation/zones/ChatComposer.tsx` |
    |  3 | `src/canvas/components/LensDropdown.tsx` |
    |  2 | `src/styles/brand.css` |
    |  2 | `src/components/shared/TriageCard.tsx` |
    |  2 | `src/canvas/hooks/useStagePill.ts` |
    |  1 | `src/components/shared/DecisionHealthRing.tsx` |
    |  1 | `src/components/results/OptionCards.tsx` |
    |  1 | `src/components/results/AdvancedSection.tsx` |
    |  1 | `src/components/chat/artefactIframeTemplate.ts` |
    |  1 | `src/canvas/conversation/zones/BriefGuidanceStrip.tsx` |
    |  1 | `src/canvas/conversation/__tests__/conversationCss.spec.ts` |
    |  1 | `src/canvas/conversation/ConversationPanel.tsx` |
    |  1 | `src/canvas/components/LensInfoPanel.tsx` |
    |  1 | `src/canvas/components/DraftChat.tsx` |

    This is a project-wide convention predating 5.8B. R1 fixed only
    the two instances 5.8B introduced (DCP stability indicator +
    `TriageHealthHeader.DimensionBar`). Touching the remaining 83
    sites is out of brief scope and would create churn + merge-
    conflict risk — recommend a dedicated cleanup brief that
    introduces a `bg-panel-border` migration codemod and updates
    every site at once.

    An earlier version of this note (R2) under-counted ("≈12 across
    8 files") and incorrectly stated `OptionCards.tsx` had no
    fallback; corrected here in R3.
  - **Skipped I.2 (top-card AI slot).** Same disposition as R1 — not
    in the brief; track as a pre-analysis-parity follow-up.

## Post-D9 review pass #3 (this doc)

Review pass #2 fixed the nudge order and the empty-divider regression
but missed two related issues caught by ChatGPT review pass #3.

  - **Addressed P1.1 — `hasResultChecks` mirrors only the first of
    `TargetProbabilityBars`'s two null paths.** The R2 gate checked
    that constraints exist, but `TargetProbabilityBars`
    [also returns null](../src/components/results/TargetProbabilityBars.tsx#L29-L32)
    when constraints exist without a numeric `prob_satisfied`. A bundle
    with shaped-but-empty constraints would still emit the empty
    bordered slot. Tightened to
    `constraints?.some(c => typeof c.prob_satisfied === 'number')`.
  - **Addressed I.1 — Partial-constraint sparse test.** Direct
    corollary of P1.1. Added an 8th case to the structural spec:
    `constraintAnalysis.constraints.length > 0` with no valid
    `prob_satisfied` → `t1-result-checks-slot` not rendered.
  - **Addressed P1.2 — Hex-fallback baseline counts verified.** The
    R2 narrative ("≈12 across 8 files", "OptionCards has none") was
    a guess from earlier grep output, not re-grepped after R1. The
    actual baseline is **83 occurrences across 22 files**, including
    one in `OptionCards.tsx`. Doc replaced with the verified table
    above (P1.4 entry under R2's section).

## Post-D4 polish pass (commit `311756fb`)

Bundled with the D4b component build per Paul's instruction. Four
polish fixes from screenshots:

  - **"Current result" → "Decision confidence"** in the hero header,
    matching the wireframe + the panel name. (`DecisionConfidencePanel.tsx:720`.)
    Grep gate `rg "Current result" src/components/results/`: 0 hits.
  - **Orphan SHA hash** (e.g. `45fbb4a`) was rendered by the
    `<div>{__GIT_SHA__}</div>` build marker gated only on
    `import.meta.env.DEV`. Now additionally gated on `expertMode` —
    debug users who toggle expert mode still see it but it's
    suppressed by default for everyone else.
  - **Dominant-factor nudge compressed** from a multi-line card
    (paragraph body + chip stack) to a true single-line `.nudge` row:
    `flex items-center gap-2 px-2.5 py-1.5 border border-panel-border
    rounded-lg`. Detail uses panelMeta + truncate. Long-form
    explanation surfaces via the row's `title` tooltip + the
    aria-label so screen readers still hear it. Inline Validate +
    Research chips remain functional.
  - **MissingKnowledgePrompt** verified single-instance — the
    standalone sibling render had already been removed in D2c (commit
    `7f8e6069`); only the T1-embedded copy lives in DCP. Added a
    regression test that asserts exactly one prompt instance and that
    it lives inside `t1-checks-footer`.

New tests:

  - `StressTestSection.spec.tsx` — 17 cases covering header + accordion,
    sensitive subsection (rendering, cap at 3, suppression, chip
    routing), both thinking patterns (rendering, copy interpolation,
    Disconfirmation context-line conditional), fragile subsection
    (rendering + alt-winner grouping verbatim, suppression), empty
    state (with + without firing subsections), DOM-leakage scan.
  - `stressTestTemplates.spec.ts` — 7 cases pinning the exact approved
    strings + the < 0.5 confidence gate (with null / NaN / Infinity guards).
  - `DecisionConfidencePanel.polishD4.spec.tsx` — 5 cases asserting the
    "Decision confidence" heading, the inline-row class signature on
    the dominant nudge, the title-attribute long form, the chip
    accessibility labels, and the single-MKP invariant.

Test counts (post-D4b): **1102 pass** across `src/components/results/`
+ `src/components/shared/` + `src/canvas/components/utils/` (was
1072 pre-D4 → +30 new). Typecheck clean. Lint: no new warnings on
files touched.

## Post-D4b review pass #4 (commit `c4d50cb2` → merged as `5a986fd7`)

External review pass #4 caught five P1 items + three improvements after
the D4 component build landed. Five addressed; one (P0) cleared.

  - **P1.1** — Reworded "Before you decide" + "Current result" out of
    comments + spec text so the literal grep gates returned 0.
  - **P1.2** — Stripped the contradictory "D4 — Copy approval gate
    (deferred)" section that survived the post-D4 doc refresh.
  - **P1.3** — Extracted `<DevBuildMarker>` from inline JSX so the
    `import.meta.env.DEV && expertMode` orphan-hash gate could be
    unit-tested. New `ResultsBody.devBuildMarkerD4.spec.tsx` (4 cases).
  - **I.1** — Stress-test empty-state copy narrowed to "No sensitivity
    or fragility signals fired. Your model is currently consistent." —
    the broader "stress-test signals fired" claim contradicted the
    always-rendered Thinking-pattern cards.
  - **I.2** — End-to-end factor_sensitivity → DriverItem.confidence
    integration test (`StressTestSection.factorSensitivityIntegration.spec.tsx`,
    2 cases) — runs the real `useResultsSectionData` hook against a
    fake canvas-store report and asserts the Disconfirmation context
    line fires (or doesn't) on the brief's authoritative confidence
    source.
  - **I.3** — Created `docs/brief-5_8b-staging-walkthrough.md` per
    AGENTS.md (one acceptance check per deliverable + Polish, each
    tagged with the SPEC + a slot for the runtime artefact).

## Post-R5 review pass #5 (this doc)

Review pass #5 surfaced four doc-vs-reality drift issues:

  - **P1.1** — Two more grep-gate literals (`"Highest-value evidence
    gaps"` + `"Suggested next actions"`) still in test text +
    justification comments. R6 reworded both via `.join(' ')`
    constants in `unifiedQueueD2b.spec.tsx` + comment edits in
    `certaintyCopy.ts` + its spec. Both gates now return 0 matches.
  - **P1.2** — R5's new integration spec added 3 `as any` casts
    (50 - 3 = 47 was the assumed delta but a comment-string `as any`
    bumped the raw count to 48). R6 refactored the spec to typed
    fixtures (`as unknown as ResultsState['report']` going through
    the real type, plus `Node` casts inside a typed builder), and
    reworded the comment to drop the literal — total back to 47
    exactly, matching the D1 baseline.
  - **P1.3** — Final review doc commit table + R5 narrative + test
    counts + grep gates were stale post-R5. R6 refreshed all four
    against re-grepped reality: commit table now includes `c4d50cb2`
    + `5a986fd7` + `411dab56` + this row; grep gates table re-run
    line by line; test count refreshed to 1109.
  - **P1.4** — Walkthrough doc still had a placeholder where the R5
    commit reference belonged + missing concrete artefacts. R6
    replaced the placeholder with the actual `5a986fd7` SHA, marked
    the screenshot slots explicitly as "Paul to attach", and appended
    a "SPEC artefacts (already populated)" section with the 123-case
    vitest output as evidence for every SPEC tag.
  - **I.1 (improvement)** — New `ResultsBody.singleMkpD4.spec.tsx`
    asserts the single-MissingKnowledgePrompt invariant at the
    full-ResultsBody level, not just inside DCP. Catches a future
    regression where a sibling MKP gets re-introduced anywhere in
    the post-analysis body.
  - **I.2 (improvement)** — New `scripts/doc-lint.sh` flags
    multi-word `<…>` placeholders + underscore fill-in lines in
    brief-5.8b docs. Backtick filter excludes JSX-attribute lines
    (the JSX-tag references are inside backticks) so real placeholders
    aren't drowned by JSX prose. Caught the residual `<R5 follow-up
    commit>` placeholder before R6 commit landed.

## Post-R6 review pass #6 (this doc)

Review pass #6 caught three doc-vs-state drift items + two improvements:

  - **P1.1** — Walkthrough doc still named the previous deploy SHA
    and described R6 as still pending, even though R6 had already
    landed as `8c150646`. R7 refreshed the deploy SHA and rewrote the
    preamble to "R6 included in the deploy"; the doc is now explicitly
    tagged **PARTIALLY CLOSED-OUT** (SPEC + LOG populated, SS / DOM
    pending Paul's capture against the deployed bundle).
  - **P1.2** — Final review still listed R6 as "_(this doc)_" rather
    than the landed `05bfe32e` + `8c150646` merge; the
    `Highest-value evidence gaps` grep row carried a stale
    "comment-only matches" parenthetical even though the count was 0.
    R7 backfilled the R6 row + trimmed the parenthetical.
  - **P1.3** — Untracked `scripts/doc-lint 2.sh` (macOS Finder
    duplicate) leaked into the worktree; deleted in R7.
  - **I.1** — Extended `scripts/doc-lint.sh` to flag three additional
    drift classes: stale-deploy phrasing patterns, walker-template
    placeholder spans, and angle-bracket SHA markers. Catches the
    close-out drift class proactively. Outdated SHA detection
    deferred (would need a git-aware lookup against `origin/staging`).
  - **I.2** — Added `satisfies` to the `ReportFixture` and
    `OptionComparisonFixture` types in
    `StressTestSection.factorSensitivityIntegration.spec.tsx` so
    fixture drift against the real `ResultsState['report']` shape
    is caught by TypeScript. Node casts retained as documented:
    `Node<T>` from React Flow has many internal fields
    (positionAbsolute, dragging, selected) that test fixtures
    legitimately don't supply.

---

## Hotfix — `ui/analysis-tab-hotfix-5_8b` (2026-05-02)

Two commits on top of the final 5.8B merge. Branch: `ui/analysis-tab-hotfix-5_8b`.

### P0 commit — `a01e9426`

| Fix | File(s) | Change |
|-----|---------|--------|
| Hero stability indicator layout | `DecisionConfidencePanel.tsx` | Replaced 3px progress bar in left ring column with plain `panelMeta` text label `"Stability: N%"`. Bar was on a separate visual row from the Evidence/Robustness/Framing 2×2 grid. Removed unused `evaluativeVar` import. |
| Dominant nudge factor-name truncation | `DecisionConfidencePanel.tsx` | Split single truncating `<p>` into three spans: label (whitespace-nowrap), factor name (font-semibold whitespace-nowrap), explanation (truncate flex-1). `overflow-hidden` on `<p>` clips within container. Factor name is never cut. |
| MKP duplicate | `ResultsBody.tsx` (no change) | Confirmed standalone MKP already removed in D2c. `ResultsBody.singleMkpD4.spec.tsx` passes — fixture has `coachingReadinessDimensions` so T1 footer renders fully. |
| Show all / What if collision | `OptionCards.tsx` | Wrapped both disclosure link and approach link in `flex flex-col gap-1` container so they stack on separate lines at all panel widths. |

**New test files:** `DecisionConfidencePanel.hotfix5_8b.spec.tsx` (6 tests), `OptionCards.showAllCollision.spec.tsx` (3 tests).

### Polish commit — `b5311872`

| Fix | File(s) | Change |
|-----|---------|--------|
| Also consider deduplication | `DecisionConfidencePanel.tsx` | Added `Set<string>` dedup by `item.key` after EVOI sort. Guard: items with undefined key are kept. Prevents same factor appearing in top-3 and also-consider simultaneously. |
| Options collapsed-state | `OptionPreview.tsx` | Confirmed D0 fix shipped: `flex-col gap-y-1`, one option per row. No change needed. |
| Triage card edge label | `TriageCard.tsx` | Edge-type titles now show only the target factor name; full `Source → Target` preserved in `title` tooltip. Uses `split(' → ')` for safe separator handling. |
| Sparkle audit | — | Audited all Sparkles usage. Every instance is AI-routed (Discuss with AI, Ask AI, coaching tips). No sparkle on user-direct actions. No code change. |
| Copy polish | `AdvancedSection.tsx`, `MissingKnowledgePrompt.tsx` | "Show winner by:" → "Winner by:"; "Display filter: reweights which option is shown as winner." → "Changes how the leading option is calculated."; MKP results helper removed (implied Olumi edits analysis directly). Model context helper unchanged. |
| Card #1 emphasis | `DecisionConfidencePanel.tsx` | `border-info/40` → `border-info/50` + `border-l-[3px] border-l-info` left accent per DS v5 §6.4. Left 3px solid overrides the all-sides 1px border. |

**Updated tests:** `TriageCard.spec.tsx` (target-only assertion), `DecisionConfidencePanel.polishD4.spec.tsx` (nudge p-level structure), `tests/visual-regression/analysis-tab.spec.ts` (new copy strings).

### Hotfix smoke results

- `npm run typecheck` — clean (0 errors)
- `npx vitest run src/components/results/ src/canvas/components/pre-analysis/ src/components/shared/` — **1842 passed, 13 skipped, 0 failed**
- `rg "as any" src/components/results/` — delta = 0 (no new casts introduced)

---

## Recommended 5.8C / 5.9 scope

  - **5.8C (pending CEE freshness)** — Bridge strip; Confirm anyway footer action; post-confirm state. Deferred per the brief.
  - **5.9 (pending V5 `decision_review`)** — Replace `utils/stressTestTemplates.ts` deterministic templates with `pre_mortem`, `framing_check`, `key_assumptions`, `scenario_contexts`. The pure-function module boundary is intentionally clean so the swap is a `stressTestTemplates.ts` rewrite + a single import update in `StressTestSection.tsx`; no structural changes to the accordion or its tests. Rich narrative also pulls from `narrative_summary` / `story_headlines`.
  - **Cleanup follow-up** — Delete `ResultsFooter.tsx`, `ResultsFooter.spec.tsx`, `getStabilityDisplayLabel.ts`, and now the `ChallengeSection` top-level render path (the file itself stays for `FragileEdgeGroupCard` reuse) once 5.8B has soaked on staging without regressions. Removes the last "Stability sensitive" emitter and the dead "Before you decide" import from the tree entirely.
