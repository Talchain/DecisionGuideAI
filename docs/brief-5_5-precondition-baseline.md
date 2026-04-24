# Brief 5.5 — Precondition baseline

Read-only audit at branch-creation point. No source edits.

## Branch

- Working branch: `ui/analysis-tab-visual-system`
- Created from: `origin/staging` HEAD = `f7907f89` (fix(v5): wire analysis_ready through applyV5State to store)
- Working tree clean at creation. 28 pre-existing stash entries (unrelated to this brief, not touched).

## Path inventory

### Source paths referenced by the brief

| Brief path | Status | Actual path (if different) |
|---|---|---|
| `src/components/results/ResultsBody.tsx` | present | — |
| `src/components/results/DecisionConfidencePanel.tsx` | present | — |
| `src/components/results/DriversSection.tsx` | present | — |
| `src/components/results/TornadoChart.tsx` | present | — |
| `src/components/results/ChallengeSection.tsx` | present | — |
| `src/components/results/ResultsFooter.tsx` | present | — |
| `src/components/results/AnalysisFooter.tsx` | moved | `src/canvas/shared/AnalysisFooter.tsx` (not edited by this brief) |
| `src/components/results/OptionCards.tsx` | present | — |
| `src/components/results/SectionHeader.tsx` | present | — |
| `src/components/results/Accordion.tsx` | present | — |
| `src/components/results/HeroSection.tsx` | **MISSING** | Hero composed inline in `DecisionConfidencePanel.tsx`. D8 will edit DCP instead. Brief permits this fallback. |
| `src/components/results/ConfidenceSection.tsx` | present | — |
| `src/components/results/AdvancedSection.tsx` | present | — |
| `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | present | — |
| `src/canvas/components/pre-analysis/StatusBanner.tsx` | **MISSING** | Readiness banner inline in `PreAnalysisPanel.tsx`. D5 will edit that file. Brief permits this. |
| `src/canvas/components/pre-analysis/OptionPreview.tsx` | present | — |
| `src/components/shared/TriageCard.tsx` | present | — |
| `src/styles/typography.ts` | present | `heroDisplay` token NOT YET present; D3 adds it. |
| `src/lib/certaintyCopy.ts` | moved | `src/components/results/utils/certaintyCopy.ts` |
| `src/canvas/components/pre-analysis/MissingKnowledgePrompt.tsx` | present | — |
| `src/components/results/CoachingPrompt.tsx` | present | Post-analysis "Something missing" renderer. |

### Authoritative reference documents

| Document | Status |
|---|---|
| `docs/Design/Olumi_Design_System_v5.md` | present |
| `docs/brief-5_3-final-review.md` | present |
| `docs/brief-5_4-preflight-findings.md` | present |
| Signal Registry v3 addendum (`olumi-ai-architecture-v3-signal-registry-addendum-v3.md`) | **NOT IN-REPO** — searched `docs/**` exhaustively |
| Boundary Contract v1.1 (`olumi-boundary-contract-v1_1.md`) | **NOT IN-REPO** |
| CC Development Standards v3 (`olumi-cc-development-standards-v3.md`) | **NOT IN-REPO** |

**Strict halt assessment:** brief D1 halt condition includes "any reference document missing." Signal Registry and Boundary Contract are not in-repo at staging HEAD. However, the brief's individual deliverables embed the relevant Signal Registry rulings inline (e.g., D14 quotes §6.4's ruling that "Olumi applied N adjustments" lives on Model tab). DS v5 IS present and is the primary reference for D2–D17 visual work.

Decision surfaced to user in reply message — proceed, halt, or obtain external copies.

## Baselines

### Typecheck
- `npm run typecheck` — **PASS** (exit 0, no errors).

### Vitest on Analysis-tab surface
- Command: `npx vitest run src/components/results src/canvas/components/pre-analysis`
- Test Files: **89 passed, 1 skipped** (90 total)
- Tests: **1563 passed, 13 skipped, 0 failed** (1576 total)
- Duration: 36.4s
- Exit code: 0

### Named pre-existing failing tests (in scope)

**None on scoped surfaces.** The brief's "no new failures" comparison set is therefore the full 1563 passing tests + 13 skipped tests listed above; any regression shows as a new failure.

CLAUDE.md memory lists three known-broken tests that would intersect this scope:
- `src/components/results/__tests__/ConfidenceSection.voi.spec.tsx` — per memory, 1 failure on topAction.couldFlip path (2026-04-08). **Observed: passed in this run.** Either fixed or the memory is stale.
- `src/components/results/__tests__/no-message-render.spec.ts` — per memory, 1 failure on ChallengeSection raw critique.message render. **Observed: passed in this run.**
- `src/components/results/__tests__/DecisionQualityChecks.spec.tsx` — per memory, 6 failures. **Not present in test run output** (likely excluded via `vitest.config.ts` or renamed/removed).

No action required; baseline is the observed pass count.

### Stale-.js shadow check
No stale `.js` files shadowing `.ts`/`.tsx` sources in `src/`.

## D12 canonical component (locked)

Both render sites:
- Pre-analysis: `src/canvas/components/pre-analysis/MissingKnowledgePrompt.tsx` — rendered from `PreAnalysisPanel.tsx:1804`. Carries helper copy (Brief 5.3 Task 12), `Tooltip`-wrapped dismiss, `focus-visible:ring-1`, `size={14}` icon.
- Post-analysis: `src/components/results/CoachingPrompt.tsx` — simpler: no helper copy, no tooltip around dismiss, no focus ring.

**Decision:** extend `MissingKnowledgePrompt` to accept a `context: 'model' | 'results'` prop driving the heading copy (`"Something missing from the model?"` vs `"Something missing from the results?"`), helper copy, and `DiscussWithAiButton` aria label. Delete `src/components/results/CoachingPrompt.tsx`. `PreAnalysisPanel.tsx` passes `context="model"`; post-analysis render site (Advanced area) imports `MissingKnowledgePrompt` with `context="results"`.

Test implications: `MissingKnowledgePrompt.spec.tsx` gains cases for the `results` context; `CoachingPrompt.spec.tsx` retires.

## D9 split (locked)

**Split into 9a + 9b.**

Evidence: grep `rg -n "Validate|Research" src/components/results/DriversSection.tsx` returns **zero matches**. The dominant-factor warning in DriversSection does not currently carry Validate/Research chips.

The "Validate/Research" chip pair lives in `DecisionConfidencePanel.tsx:314/323` inside `ScienceNudgeCard`, a render path inside the DCP. The standalone factor card the brief targets for removal is `src/components/results/AttentionBanner.tsx` (rendered by `ResultsBody.tsx:214` between DCP and "Your options"). Per `ResultsBody.tsx:208-212`, Brief 5.4 closeout already filters overlapping factors — but the banner still renders when a non-DCP factor exists.

Sequence:
- **9a:** fold Validate/Research action chips into the dominant-factor warning rendering in `DriversSection.tsx` (preserving per-factor `onFocusNode` + `onSendMessage` plumbing).
- **9b:** remove the standalone `AttentionBanner` render path between Top evidence and Your options, per Brief 5.4 Phase 2 completion.

Phase-0 signal-home check must run during 9b implementation: confirm `AttentionBanner` is not the sole consumer of `humanisedCritiques` signal. If it is, halt per brief STOP trigger 5.

## Reference-section citations (for downstream deliverables)

### DS v5 sections cited by this brief
- §2 — Typography (D3, D4)
- §3 — Colour (D7, D15)
- §4 — Spacing (D15)
- §6 — Footer rules (D15 perimeter check)
- §8 — Components (D4, D6, D15)
- §9 — Icons (D16)
- §27.2 — Cards (D15)

### Signal Registry v3 sections quoted by this brief
- §6.4 — Pre-analysis surfaces (D14 "Olumi applied N adjustments" removal)
- §6.5 — Post-analysis surfaces (D5 scope subtitles)

Both sections' ruling content is quoted inline in the brief deliverables; the authoritative text is not readable from-repo (see strict-halt assessment above).

## Citation protocol (locked by user decision)

Signal Registry v3 and Boundary Contract v1.1 are not readable from-repo. User approved **proceed with flag** (option 3 of the halt decision surfaced during D1).

**Rule:** any commit that cites Signal Registry v3 or Boundary Contract v1.1 must include a trailing footer line in the commit message body:

> Registry/contract citation unverified against source document — brief inline text treated as authoritative.

**Applies to:** D10 (Top evidence concept ownership), D14 (structural_repairs surface allocation per §6.4), and any other deliverable that cites a Signal Registry or Boundary Contract section. DS v5 citations do NOT need this annotation — source is in-repo at `docs/Design/Olumi_Design_System_v5.md`.

## Approved corrections applied

Per user approval before D1:
- Correction 5 (list pre-existing failures by name): done — zero named failures in scope.
- Correction 6 (lock D9 split, not "possibly"): done — 9a + 9b.

Corrections 1–4 apply to D2 spec authoring (bg-factor runtime check, D8 full scope, D12 canonical lock reflected, trust narrative decision).
