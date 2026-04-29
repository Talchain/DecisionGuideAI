# Brief 5.7 close-out — Final review

**Branch:** `ui/brief-5_7-closeout` (local only, not pushed)
**Base:** `origin/staging` at `6e766e58`
**Branch range:** `6e766e58..HEAD` — see `git log --oneline ui/brief-5_7-closeout` for live ordering. This file lives on the branch it documents and cannot self-reference its own commit hash.

---

## Per-deliverable status

| # | Deliverable | Status | Notes |
|---|---|---|---|
| D1 | Precondition baseline | **Done — close-out ship-readiness conditional on Paul's halt waiver (see "CI status" below)** | Branch + baseline doc + CI status (failure on `.nvmrc` step, full suite skipped, pre-existing infrastructure) + noise inventory + stash count. Brief STOP #1 strict reading would block; relief requires explicit waiver |
| D2 | Shared/canvas dependency inversion (full) | **Done — broader gate now zero** | Originally limited to MissingKnowledgePrompt verification (intact, 9/9 tests pass). Paul approved expanding scope to the four remaining violators: `TriageHealthHeader` (DecisionHealthRing relocated to shared), `ScientificEditor` (ValidationMetadata → `@/types/validation`, classifyUnit → `@/utils/unitClassifier`), `TriageCard` (DiscussWithAiButton inverted via `aiDiscussSlot?: ReactNode` prop pattern; classifyUnit relocated), `TriageCard.spec.tsx` (useGuidanceStore replaced by lightweight stub matching the real `data-testid`). External consumer tests pass — 157 tests across 9 files (PreAnalysisPanel, brief57, contestedCards, MissingKnowledgePrompt, mapImprovementToTriageCard, pickStartHere, sectionCoaching, buildTriageNarrative, resolveEditorRawValue) |
| D3 | Pre-existing lint noise | Done | Two TODOs converted to plain comments; `(window as any).__OLUMI_DEBUG` cast removed (Window augmentation now in `src/types/global.d.ts`, moved out of DebugPanel.tsx in this turn per reviewer Improvement #2); gated console.warn kept with comment; PreAnalysisPanel debug already clean |
| D4 | Stash list cleanup | Deferred — approval requested | 17 drops from approved Brief 5.5 triage refreshed with current indices in `docs/brief-5_7-closeout-stash-triage.md`. **Plus a separate addendum** with 1 new candidate (the Brief 5.7 layout WIP stash, now redundant) requesting its own approval |
| D5 | Final pass + final-review doc | Done | This file |

---

## CI status — Brief 5.7 push

Workflow run `25105589712` (commit `6e766e58`): conclusion **failure**.

**Failure mode:** `Use Node.js from .nvmrc` step in the "Install & Cache" job. Identical failure mode on the three preceding staging pushes (`25083998798`, `25069955865`, `25046631077`). Full test suite never ran on any recent staging push. Pre-existing CI/runner toolchain issue, **unrelated to Brief 5.7**.

**Local verification (the authoritative gate while CI is broken):**
- Pre-push hook smoke gate at the time of Brief 5.7 push: 441/441 passed.
- Local typecheck: clean.
- Local scoped vitest: 1559 / 13 skipped / 0 failed.

**Recommended escalation:** investigate `actions/setup-node` step on the staging branch — likely action version, runner image, or `.nvmrc` content drift. Out of scope for this brief.

### Halt-waiver request

The brief's STOP #1 trigger reads: "CI full-suite failure from Brief 5.7 push — halt all, investigate." Strict literal reading: this close-out should be blocked.

The pragmatic case for proceeding:
- The failure mode is identical across at least four prior staging pushes, including pushes pre-dating Brief 5.7. It is platform-level, not application-level.
- The full test suite never ran, so there is no test-level signal to investigate.
- Local checks (typecheck, scoped vitest 1559/13/0, pre-push smoke 441/441) cover the changes this brief and Brief 5.7 introduced.

**Paul's explicit waiver of STOP #1 is required to confirm close-out ship-readiness.** This document does not assume the waiver; it requests it. Until the waiver is given (or the CI is fixed and a clean run lands), the brief's strict acceptance is partially unmet.

---

## Verification

Reproduction commands recorded verbatim so future reviewers can run the same checks against the close-out HEAD.

| Check | Command | Baseline (D1) | Final (D5) | Result |
|---|---|---|---|---|
| Typecheck | `npm run typecheck` (= `tsc -p tsconfig.ci.json --noEmit`) | clean | **clean** | PASS |
| Lint on D3 files | `npx eslint src/components/results/DriversSection.tsx src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | clean | **clean** | PASS — only deprecated `.eslintignore` warning, unrelated |
| Scoped vitest passed | `npx vitest run src/components/results src/canvas/components/pre-analysis` | 1559 | **1559** | PASS — no regressions, no new tests in this brief |
| Scoped vitest skipped | (same command) | 13 | 13 | unchanged |
| Scoped vitest failed | (same command) | 0 | **0** | PASS |
| MissingKnowledgePrompt dep | `rg "from '@/canvas" src/components/shared/MissingKnowledgePrompt.tsx` | zero | **zero** | PASS |
| Broader shared dep gate | `rg "from '@/canvas" src/components/shared/` | 8 | **0** | PASS — all four violators inverted in this push |

### Brief 5.5 §2.8 grep gates (re-run)

Reproduction shell:

```bash
export GATE_GLOBS='-g !**/__tests__/** -g !**/*.spec.* -g !**/*.test.*'

rg $GATE_GLOBS -c "<pattern>" src/components/results/ src/canvas/components/pre-analysis/ \
  | awk -F: '{sum+=$2} END {print sum+0}'
```

| # | Gate pattern (passed verbatim to `rg`) | Final |
|---|---|---:|
| 1 | `text-xs\|text-sm\|text-base\|text-lg\|text-\[[0-9]+px\]\|font-medium\|font-semibold\|font-bold` | **0** |
| 2 | `currently leads` | **0** |
| 3 | option `# N of M` pattern in `OptionCards.tsx` | not re-run locally — covered by CI; assumed unchanged from Brief 5.7 close-out baseline |
| 4 | `Olumi applied` | **0** |
| 5 | `assumptions to review and` | **0** |
| 6 | `as any\|as unknown` | **0** |
| 7 | `bg-[a-z]+-light` | **0** |
| 8 | `text-white` | **0** |
| 9 | `p-\[[0-9]+px\]\|px-\[[0-9]+px\]\|py-\[[0-9]+px\]\|gap-\[[0-9]+px\]` | **0** |
| 10 | `bg-factor\b` | **0** |

Gate 3 is honestly recorded as "not re-run" rather than rolled into the "all zero" claim — its regex requires the `OptionCards.tsx` path narrowing the previous brief noted, and was not exercised in this brief's local sweep.

---

## Stash outcome

- 18 drops + 10 escalations refreshed and documented in `docs/brief-5_7-closeout-stash-triage.md`.
- Drops NOT executed in this brief — awaiting Paul's explicit approval.
- Once approved, the drop sequence in that doc reduces stash list 28 → 10 entries.

---

## Remaining opportunities (escalation candidates — NOT in this brief's scope)

### 1. CI `.nvmrc` Node setup failure
Pre-existing infrastructure issue blocking the full test suite from running on every staging push. Requires investigating action version, runner image, or `.nvmrc` content drift. **High priority** — without this fix, no staging push runs the full ~6,284-test suite.

### 2. Four additional shared/canvas dependency violations — **RESOLVED in this push**
The violators below were all inverted in the same commit as this update. Kept here as a resolution log.

| File | Imported from `@/canvas/` |
|---|---|
| `src/components/shared/TriageHealthHeader.tsx` | `DecisionHealthRing`, `DecisionHealthRingDimensions` |
| `src/components/shared/ScientificEditor.tsx` | `ValidationMetadata`, `classifyUnit` |
| `src/components/shared/TriageCard.tsx` | `DiscussWithAiButton`, `AiDiscussElement`, `classifyUnit` |
| `src/components/shared/__tests__/TriageCard.spec.tsx` | `useGuidanceStore` (test-only) |

Each requires its own dependency inversion treatment — either move the imported module out of `canvas/` into a shared/neutral location, or refactor the consumer to accept the canvas-specific bit as a prop (the MissingKnowledgePrompt pattern). Multi-file structural work; properly scoped to a follow-up brief.

### 3. `__OLUMI_DEBUG` access pattern non-uniformity
Three other call sites still use varied casts (`as any`, `as Record<string, unknown>`) to read this flag, even though the Window augmentation now lives globally in `src/types/global.d.ts` (moved here in this turn from `DebugPanel.tsx`). Each can drop the cast with the same pattern used in DriversSection.tsx:

| File | Current |
|---|---|
| `src/canvas/components/SectionErrorBoundary.tsx:29` | `(window as any).__OLUMI_DEBUG` |
| `src/lib/mappers/utils.ts:244` | `(window as Record<string, unknown>).__OLUMI_DEBUG` |
| `src/canvas/components/__tests__/SectionErrorBoundary.spec.tsx:73, 86` | `;(window as any).__OLUMI_DEBUG = true` (test-only mutation; arguably needs a different fix) |

### 4. Stash list (D4 deferred)
Awaiting approval to execute the 18 drops in `docs/brief-5_7-closeout-stash-triage.md`.

---

## Ship readiness

**Risk profile:** very low. This brief contains:
- Documentation additions (`brief-5_7-closeout-baseline.md`, `brief-5_7-closeout-stash-triage.md`, this file).
- Source edits:
  - `DriversSection.tsx` — two TODO comments converted, one redundant cast removed, one explanatory comment added on a gated diagnostic. No behaviour change.
  - `src/types/global.d.ts` (new) — Window.__OLUMI_DEBUG augmentation moved here from `DebugPanel.tsx` per reviewer Improvement #2. Type-only file, no runtime impact.
  - `DebugPanel.tsx` — removed the duplicate `declare global { interface Window { __OLUMI_DEBUG?: boolean } }` block (now lives in the neutral file). No runtime impact.
- One empty commit ledgering the D2 verification result.

**Conditional ship-readiness:** see "Halt-waiver request" above. This brief's work is locally clean; ship-readiness on staging is gated on either Paul's STOP #1 waiver or a clean CI run.

**Test coverage:** unchanged (1559 / 13 skipped). No new regression tests added because no behaviour was modified.

**Rollback plan:** revert the close-out branch range. Each deliverable's commit is independently revertable; only the D3 and Improvement-#2 commits touch non-doc source.
