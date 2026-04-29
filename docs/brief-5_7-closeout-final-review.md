# Brief 5.7 close-out — Final review

**Branch:** `ui/brief-5_7-closeout` (local only, not pushed)
**Base:** `origin/staging` at `6e766e58`
**Branch range:** `6e766e58..HEAD` — see `git log --oneline ui/brief-5_7-closeout` for live ordering. This file lives on the branch it documents and cannot self-reference its own commit hash.

---

## Per-deliverable status

| # | Deliverable | Status | Notes |
|---|---|---|---|
| D1 | Precondition baseline | Done | Branch + baseline doc + CI status (failure on `.nvmrc` step, full suite skipped, pre-existing infrastructure) + noise inventory + stash count |
| D2 | MissingKnowledgePrompt dependency inversion | Done — verification only | `aiAffordance?: ReactNode` prop intact; both consumers pass it correctly; 9/9 tests pass; broader 4-file shared/canvas violation flagged for separate follow-up |
| D3 | Pre-existing lint noise | Done | Two TODOs converted to plain comments; `(window as any).__OLUMI_DEBUG` cast removed (Window augmentation lives in DebugPanel.tsx); gated console.warn kept with comment; PreAnalysisPanel debug already clean |
| D4 | Stash list cleanup | Deferred — approval requested | 18 drops + 10 escalations refreshed in `docs/brief-5_7-closeout-stash-triage.md` with current indices; ready-to-run drop block included |
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

---

## Verification

| Check | Baseline (D1) | Final (D5) | Result |
|---|---|---|---|
| `npm run typecheck` | clean | **clean** | PASS |
| Lint on D3 files | clean | **clean** | PASS — only deprecated `.eslintignore` warning, unrelated |
| Scoped vitest pass count | 1559 | **1559** | PASS — no regressions, no new tests in this brief |
| Scoped vitest skipped | 13 | 13 | unchanged |
| Scoped vitest failed | 0 | **0** | PASS |
| `rg "from '@/canvas" src/components/shared/MissingKnowledgePrompt.tsx` | zero | **zero** | PASS |
| `rg "from '@/canvas" src/components/shared/` (broader) | 8 | 8 | flagged as out-of-scope follow-up (see below) |

### Brief 5.5 §2.8 grep gates (re-run)

All ten gates remain at zero:

| # | Gate | Final |
|---|---|---:|
| 1 | typography utilities (text-xs/sm/base/lg/[Npx], font-medium/semibold/bold) | **0** |
| 2 | "currently leads" | **0** |
| 3 | option `# N of M` pattern | (CI gate; baseline assumed) |
| 4 | "Olumi applied" | **0** |
| 5 | "assumptions to review and" | **0** |
| 6 | `as any` / `as unknown` summed | **0** |
| 7 | `bg-{colour}-light` | **0** |
| 8 | `text-white` | **0** |
| 9 | arbitrary px spacing | **0** |
| 10 | `bg-factor` | **0** |

---

## Stash outcome

- 18 drops + 10 escalations refreshed and documented in `docs/brief-5_7-closeout-stash-triage.md`.
- Drops NOT executed in this brief — awaiting Paul's explicit approval.
- Once approved, the drop sequence in that doc reduces stash list 28 → 10 entries.

---

## Remaining opportunities (escalation candidates — NOT in this brief's scope)

### 1. CI `.nvmrc` Node setup failure
Pre-existing infrastructure issue blocking the full test suite from running on every staging push. Requires investigating action version, runner image, or `.nvmrc` content drift. **High priority** — without this fix, no staging push runs the full ~6,284-test suite.

### 2. Three additional shared/canvas dependency violations
Beyond MissingKnowledgePrompt, four other shared components still import from `@/canvas/`:

| File | Imported from `@/canvas/` |
|---|---|
| `src/components/shared/TriageHealthHeader.tsx` | `DecisionHealthRing`, `DecisionHealthRingDimensions` |
| `src/components/shared/ScientificEditor.tsx` | `ValidationMetadata`, `classifyUnit` |
| `src/components/shared/TriageCard.tsx` | `DiscussWithAiButton`, `AiDiscussElement`, `classifyUnit` |
| `src/components/shared/__tests__/TriageCard.spec.tsx` | `useGuidanceStore` (test-only) |

Each requires its own dependency inversion treatment — either move the imported module out of `canvas/` into a shared/neutral location, or refactor the consumer to accept the canvas-specific bit as a prop (the MissingKnowledgePrompt pattern). Multi-file structural work; properly scoped to a follow-up brief.

### 3. `__OLUMI_DEBUG` access pattern non-uniformity
Three other call sites in the codebase still use varied casts (`as any`, `as Record<string, unknown>`) to read this flag, even though the Window augmentation is already declared globally in `DebugPanel.tsx`. Codify the pattern across the codebase:

| File | Current |
|---|---|
| `src/canvas/components/SectionErrorBoundary.tsx:29` | `(window as any).__OLUMI_DEBUG` |
| `src/lib/mappers/utils.ts:244` | `(window as Record<string, unknown>).__OLUMI_DEBUG` |
| `src/canvas/components/__tests__/SectionErrorBoundary.spec.tsx:73, 86` | `;(window as any).__OLUMI_DEBUG = true` (test-only mutation; arguably needs a different fix) |

Each can drop the cast with the same pattern used in DriversSection.tsx by D3 of this brief.

### 4. Stash list (D4 deferred)
Awaiting approval to execute the 18 drops in `docs/brief-5_7-closeout-stash-triage.md`.

---

## Ship readiness

**Risk profile:** very low. This brief contains **only**:
- Documentation additions (`brief-5_7-closeout-baseline.md`, `brief-5_7-closeout-stash-triage.md`, this file).
- One source-file edit: `DriversSection.tsx` — two TODO comments converted, one redundant cast removed, one explanatory comment added on a gated diagnostic. No behaviour change.
- One empty commit ledgering the D2 verification result.

**Test coverage:** unchanged (1559 / 13 skipped). No new regression tests added because no behaviour was modified.

**Rollback plan:** revert the close-out branch range. Each deliverable's commit is independently revertable; only D3's commit touches non-doc source.
