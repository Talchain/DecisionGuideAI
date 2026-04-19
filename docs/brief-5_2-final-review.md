# Brief 5.2 — Final review

**Branch:** `ui/analysis-tab-brief-5_2-hotfix` from `staging` @ `9b1634d2`
**Scope:** Analysis-tab hotfix — four Brief 5.1 acceptance misses + three regressions, all UI-only, surgical.

## Per-task outcome

| Task | Scope | Delivered | Commit(s) |
|---|---|---|---|
| Phase 0 | Pre-flight evidence + gate resolution | ✅ | `6e621bff` |
| Task 1 | Hero + footer tier calibration (needs_work/weak readiness suppresses over-confident coaching copy; adds "by N points" suffix; footer reads "Stability sensitive" when tier is weak) | ✅ | `81070bdb`, `6b7141aa` (follow-up) |
| Task 2 | Footer hash — gate already in place; added `data-testid="advanced-hash-row"` + auto-expand regression guard (verification-only) | ✅ | `f2d33b4b` |
| Task 3 | Missing-data inline editor by default; Pencil removed; one-active-editor invariant preserved via simplified `activeEditorKey==null` semantics | ✅ | `8fa22b60` |
| Task 4 | "Your options" coaching parity — verified already unified; added byte-identical regression test (verification-only) | ✅ | `7fad9f8f` |
| Task 5 | Review-next compact subtitle truncation — verified `ExpandableCoachingText` still wired; added longer-subtitle regression test (verification-only) | ✅ | `020f2196` |
| Task 6 | Fragility row completion — single arrow, stripped `(Status Quo)`, "could overtake" unified, Stability pill top-right, chip for consolidated groups; shared `stripStatusQuoSuffixForDisplay` helper extracted | ✅ | `06694376`, `c1ea7821` (follow-up) |
| Task 7 | Expertise sparkles — `variant="secondary"` on `AiEstimated` + `MissingData` sparkles (opacity-50 at rest, opacity-100 on hover/focus) | ✅ | `d80a76a4` |
| Task 8 | (8a) Improve-confidence count drops the expertise term; (8b) Confirm icon hidden on "—" rows; (8c) Gauge icon verified + regression-guarded; (8d) technique chip wired to click-to-chat when `onSendMessage` available | ✅ | `72125224`, `eee41ba2` (follow-up) |

## Verification-items status (explicit deferred vs implemented)

Phase 0 locked decisions for Task 8 sub-items; this table resolves "complete but partial" ambiguity for subsequent briefs.

| Verification item | Status | Resolution |
|---|---|---|
| 8a — Improve-confidence count off-by-one | **Implemented** | `improveConfidenceCount` formula no longer adds `+(expertiseHasItems ? 1 : 0)`; matches rendered rows inside the section. Code comment documents the rendered-only rule. |
| 8b — Confirm icon on "—" rows | **Implemented** | AiEstimated Confirm button gated on `display != null`. Edit affordance retained so users can still set the missing value. |
| 8c — Gauge icon at Risk profile header | **Verified present + regression-guarded** | Already shipped in Brief 5.1 Task 6 at AdvancedSection.tsx:164. Test asserts SVG inside the heading with `aria-hidden="true"` so a future icon-dict refactor can't quietly drop it. |
| 8d — Technique chip click-path | **Implemented** (re-scoped during ChatGPT follow-up review) | Initially locked hint-only in Phase 0 on "surgical edits only" grounds. ChatGPT review flagged this as diverging from the brief's "If decorative: wire it" direction. Re-scoped to wire `onSendMessage` through `PreAnalysisPanel → YourExpertise → MissingData`; hint becomes a button when the chat handler is registered, falls back to a tooltip span otherwise. |
| ChatGPT P0 #1 — coaching override scope | **Implemented** (follow-up) | Added `conservative: boolean` to `CertaintyCopy`; `DecisionConfidencePanel` now suppresses PLoT coaching overrides on every non-Rule-6 branch (not just caveat-bearing ones). |
| ChatGPT P0 #2 — consolidated chip wrong id | **Implemented** (follow-up) | Chip always uses per-row `edgeFocusId`. Removed the group-level `focusId` fallback. |
| ChatGPT P1 #2 — per-row callback target tests | **Implemented** (follow-up) | New assertions for consolidated and non-consolidated multi-row cards that each chip fires with its own `from_id`. |
| ChatGPT P1 #3 — non-caveat conservative headline tests | **Implemented** (follow-up) | Rule 1 / Rule 5 / Rule 7 + conflicting `coachingHeadline` all covered in `DecisionConfidencePanel.caveatGuarantee.spec.tsx`. |
| ChatGPT Improvement #1 — matrix integration spec | **Implemented** (follow-up) | New `HeroFooterAlignment.matrix.spec.tsx` exercises 7 matrix rows plus a 6-row weak-tier stress band. |
| ChatGPT Improvement #2 — expert-trio grep/test | **Deferred** | Out of scope for Brief 5.2. Belongs to a Brief 4 Task 4 follow-up. Registered below. |
| ChatGPT Improvement #3 — deferred-vs-implemented clarity | **Implemented** | This table. |

### Registered follow-ups (not implemented in this brief)

- **Expert-trio leak grep**: add a regression test that scans the rendered Analysis-tab body in standard mode for `elasticity`, `stability`, `influence` expert-only copy. Needs a test fixture with the full results tree mounted, which this brief's scope did not include.
- **Target-factor tooltip on fragility rows**: Brief 5.2 Task 6 dropped the inline `source → target` arrow; the target factor is no longer in the row text. Power users who want the full edge identity could benefit from a hover tooltip exposing the target label.
- **Dormancy SoT, untracked files, stale CLAUDE.md**: close-out items carried over from Brief 5.1; not folded in.

## Grep gates — final

All gates green (hits below are all comments or test assertions; zero live-code violations):

- `rg -n "clear leading" src/` — only `"no clear leading option"` (intended softened lede from `certaintyCopy.ts:121`), one unrelated compare-tab banner, comments/tests.
- `rg -n "Stable result · " src/` — only in test strings and code comments. `src/lib/stability.ts` emits `heroLabel: 'Stable result'` (no `·`); the `·` separator is composed by callers.
- `rg -n "Validate this relationship" src/` — **zero**.
- `rg -n "could win" src/components/results` — only in one code comment (`ChallengeSection.tsx:245`) and test documentation; zero in live output.
- `rg -n "\(Status Quo\)" src/components/results/ChallengeSection.tsx` — only in code comments explaining the strip; zero in render output.

## Diff summary

Across 9 phase commits (plus the Phase 0 findings doc) and this final-pass commit:

- **8 production files** changed (`DecisionConfidencePanel.tsx`, `ResultsBody.tsx`, `ResultsFooter.tsx`, `ChallengeSection.tsx`, `AdvancedSection.tsx`, `AiEstimated.tsx`, `MissingData.tsx`, `PreAnalysisPanel.tsx`).
- **2 new Analysis-tab-local utilities**: `getStabilityDisplayLabel.ts`, `stripStatusQuoSuffixForDisplay` (added to `cleanFactorLabel.ts`). No shared-utility signature changes (`src/lib/stability.ts` unchanged).
- **1 new prop** on `buildCertaintyCopy`: optional `winProbabilityGap?: number` (backward-compatible; previous caller at `DecisionConfidencePanel.tsx:467` is the only consumer in production).
- **+1,387 / −239** lines across 24 files, ~60% of additions are tests.

## Test additions

- `certaintyCopy.spec.ts` — 8 tests for the `winProbabilityGap` suffix + 10 tests for the `conservative` flag (ChatGPT P0 #1 follow-up).
- `getStabilityDisplayLabel.spec.ts` — new file, 16 tests covering the tier × stability matrix.
- `ResultsFooter.spec.tsx` — new file, 10 tests locking the rendered footer copy for tier × stability combinations including the bundle-609164c7 case.
- `DecisionConfidencePanel.caveatGuarantee.spec.tsx` — rewritten to lock the Brief 5.2 precedence flip; follow-up added 3 tests for non-caveat conservative branches (unstable, fair tier, fallback) + flipped the "fair tier + ready → coaching wins" test to assert coaching is suppressed.
- `ChallengeSection.fragileRows.spec.tsx` — rewritten: "could overtake" verb, Status-Quo strip, single-arrow invariant, top-right pill, consolidated-group chip; follow-up added per-row callback target assertions for consolidated and non-consolidated groups.
- `cleanFactorLabel.spec.ts` — 13 new tests for `stripStatusQuoSuffixForDisplay` + delegation via `formatOptionLabelForCard`.
- `TriageCard.spec.tsx` — new longer-subtitle regression guard (ASCII and Unicode ellipsis absent).
- `OptionPreview.spec.tsx` — byte-identical collapsed/expanded coaching parity guard.
- `AdvancedSection.spec.tsx` — 3 new tests: testid presence, testid absence under auto-expand, Gauge-icon presence at Risk profile heading.
- `AiEstimated.valueAndIconParity.spec.tsx` — Confirm-on-missing gate, sparkle-secondary variant; follow-up swapped the hint-only lock for click-to-chat button coverage (onSendMessage wired + fallback span when absent + keyboard focus-ring).
- `YourExpertise.inlineEditor.spec.tsx` — one-active-editor invariant rewritten for the simplified state model.
- `YourExpertise.parity.spec.tsx` — fixture updated with `rawValue` so the Confirm button still renders under the Brief 5.2 Task 8b gate.
- `HeroFooterAlignment.matrix.spec.tsx` — new file (ChatGPT Improvement #1). 7 parameterized matrix rows + 6-row weak-tier stress band exercising `DecisionConfidencePanel` and `ResultsFooter` together across tier × readiness × stability.

## Tier-3 validation (pre-push)

- `npm run typecheck` — **pass** (tsc clean).
- `npm run lint` — **0 errors**, 1116 warnings, all pre-existing (no new warnings introduced by touched files).
- `npx vitest run --changed --bail=1` — **94 passed, 1 pre-existing failure** (`tests/visual-regression/analysis-tab.spec.ts` tornado test expecting `data-testid="tornado-apply-rerun"` that the current render does not emit; verified absent on `staging` before my edits, so not a regression from this branch).
- `bash scripts/pre-push-validate.sh` — **full suite: 6188 passed, 1 failed**. The single vitest failure is the pre-existing tornado-apply-rerun test. The pre-push script's own summary reads `✓ Test suite passed (full run, known-broken excluded)` for the vitest step. One non-vitest check failed: **Check 5 — Dependency audit** flags `"@talchain/schemas": "file:./vendor/talchain-schemas-0.5.1.tgz"` at `package.json:87`. This entry exists identically on `staging` (confirmed via `git show staging:package.json`) — it is a pre-existing repo condition, not introduced by this branch. Duration 893s (~15 min). Two `ERR_WORKER_OUT_OF_MEMORY` warnings appeared at the end of the run — the CLAUDE.md guidance already notes this is expected for the local full suite and the script explicitly parses past it.

## Perf audit

- `DecisionConfidencePanel.tsx` — new `winProbabilityGap` derivation and updated `certainty` memo both wrapped in `useMemo` with correct deps. No new `useEffect`. Panel hot path untouched.
- `ResultsFooter.tsx` — stateless function; no memoisation needed. `getStabilityDisplayLabel` is a pure function.
- `MissingData.tsx` — simplified render path (editor-default-open, Pencil removed) is a net reduction in render work per row.
- `ChallengeSection.tsx` — single arrow render, no new loops or allocations.

## Cross-task consistency

- Typography tokens preserved (`typography.panelHeader / panelBody / panelMeta`). Grep for `text-sm|text-xs|text-base` across touched files → zero raw utilities. ✓
- Icon sizing consistent at 14 px where relevant.
- Aria vocabulary consistent ("Review {source} in the inspector"; "Confirm value for {label}"; "Set value for {label}").
- British English preserved.
- Zero em dashes in new UI copy.

## Launch triage — evidence-led

### Ready to ship

- **Task 1** (P0): the headline-suppression + Stability-sensitive footer directly addresses the staging-QA complaint on bundle 609164c7. Snapshot/matrix tests pinpoint the regression site.
- **Task 2** (P0): adds test precision without code gate change. Safe to ship.
- **Task 3**, **Task 6**, **Task 7**, **Task 8**: surgical UI edits, full test coverage, grep gates green.

### Watch on release

- **Task 6 single-arrow restructure** changes the fragility row clause from `If {source} → {target} shifts` to `If {source} shifts`. Target factor moves to tooltip / expert-only detail (not yet wired into a tooltip — current behaviour is just "dropped from the visible row"). **Opportunity for a follow-up**: surface the target factor in a hover tooltip for power users who want the full edge identity.
- **Task 4 / Task 5** were verification-only. If any QA pass does reproduce the divergence/truncation at 1280×900, treat as a new regression from a different source.

### Deferred / out of scope (unchanged)

- Top-evidence IA dedup (Brief 5 Task 5 follow-up).
- Structurally-different option draft action (upstream brief).
- Debug/payload logging audit (separate).
- `decision_brief.headline` consumer audit — completed in Phase 0 findings; no additional surfaces need attention.

## Self-check against brief acceptance criteria

- ✅ Hero: `{Winner} currently leads by N points` + caveat for weak-tier bundle 609164c7 (gap suffix preserves numeric lead).
- ✅ Hero: `{Winner} is the leading option` preserved for strong+ready bundles.
- ✅ Footer: `Stability sensitive` overrides numeric at weak tier; passes through at strong/fair.
- ✅ Standard view: no hex-like hash token in the Analysis results body.
- ✅ Missing-data row default: factor label + Not set + inline ScientificEditor + technique hint + sparkle; no Pencil.
- ✅ Opening an AiEstimated editor collapses all Missing-data editors; closing re-opens.
- ✅ Compact subtitle never ellipsises (regression-guarded for both default and compact variants).
- ✅ Fragility row: single arrow, alt-winner semibold + Status-Quo stripped, "could overtake" unified, Stability pill top-right, Review this relationship chip per row (including consolidated groups).
- ✅ Expertise sparkles: opacity-50 at rest, opacity-100 on hover / focus / focus-within.
- ✅ Improve-confidence header count matches visible rows within the section (expertise excluded).
- ✅ Confirm icon hidden on `—` rows; Edit/Pencil remains.
- ✅ Gauge icon present at Risk profile heading; regression-guarded.
- ✅ Technique hint locked as non-interactive (by-design decision documented).

## Reporting

Branch is ready to push to `staging` when you give the go-ahead. No push performed yet — awaiting approval per the brief's commit policy.

The pre-push script's one failing check (dependency audit on `@talchain/schemas` file: reference) exists identically on `staging`, so pushing this branch will not make any check *worse*. If the repo wants that dependency audit to pass for future pushes, address it in a separate commit — it is outside this brief's scope.

---

*End of Brief 5.2 final review.*
