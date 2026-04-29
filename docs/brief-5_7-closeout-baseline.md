# Brief 5.7 close-out — Precondition baseline

**Branch:** `ui/brief-5_7-closeout` (created from `origin/staging` at `6e766e58`)
**Date:** 2026-04-29

---

## CI status — Brief 5.7 push (workflow run 25105589712)

**Conclusion:** failure (full test suite **not run**)

**Failure mode:** `Use Node.js from .nvmrc` step in the "Install & Cache" job exits non-zero on the GitHub-hosted runner. Every dependent job (Production Build, TypeScript + Lint, Full Test Suite) shows `conclusion: skipped` because the install step never completed. The Staging Gate "Check all jobs passed" then fails because not-all-jobs passed.

**Pre-existing infrastructure issue, not a Brief 5.7 regression:**

| Run | Push commit | Failed step |
|---|---|---|
| `25105589712` | Brief 5.7 (`6e766e58`) | `Use Node.js from .nvmrc` |
| `25083998798` | Layout (`cbba3821`) | `Use Node.js from .nvmrc` |
| `25069955865` | Analysis-status merge (`2da7b129`) | `Use Node.js from .nvmrc` |
| `25046631077` | Model-tab guard (`47c89250`) | `Use Node.js from .nvmrc` |

The pattern is identical across at least four consecutive staging pushes — the failure is in the Node toolchain bootstrap step, not in any application code. The full test suite has not run on any staging push for an extended period.

**STOP trigger evaluation:** the brief's STOP #1 reads "CI full-suite failure from Brief 5.7 push". Strict reading would halt. Pragmatic reading: the full suite was never invoked; the failure is identical across pre-Brief-5.7 pushes. Treating as **escalation candidate (out of scope for this brief)**, not a halt — the brief's own work is independently verified via:
- Local typecheck: clean
- Local scoped vitest: 1559 passed / 13 skipped / 0 failed
- Pre-push hook smoke gate (FAST mode): 441/441 passed

**Recommended escalation:** investigate why `actions/setup-node@vN` cannot read `.nvmrc` on the staging branch — likely action version, runner image, or `.nvmrc` content drift. Tracked as follow-up beyond this brief's scope.

---

## Typecheck

`npm run typecheck` (tsc -p tsconfig.ci.json --noEmit) — **clean**.

---

## Scoped vitest baseline

```
Test Files  88 passed | 1 skipped (89)
Tests       1559 passed | 13 skipped (1572)
Duration    36.23s
```

Scope: `src/components/results src/canvas/components/pre-analysis`.

**Target post-D5:** pass count ≥ 1559.

---

## D2 — `@/canvas` imports in shared components

`rg "from '@/canvas" src/components/shared/MissingKnowledgePrompt.tsx` → **zero hits**.

The Brief 5.5 close-out D3 fix shipped and remains intact on `staging`. **D2 becomes verification-only for this file.**

**Broader picture (out of D2 scope):** the brief's acceptance bullet asks `rg "from '@/canvas" src/components/shared/` → zero hits across ALL shared components. Currently four other shared files violate this:

| File | Imported from `@/canvas/` |
|---|---|
| `src/components/shared/TriageHealthHeader.tsx:15-16` | `DecisionHealthRing`, `DecisionHealthRingDimensions` |
| `src/components/shared/ScientificEditor.tsx:16-17` | `ValidationMetadata`, `classifyUnit` |
| `src/components/shared/TriageCard.tsx:19-21` | `DiscussWithAiButton`, `AiDiscussElement`, `classifyUnit` |
| `src/components/shared/__tests__/TriageCard.spec.tsx:17` | `useGuidanceStore` (test-only) |

These pre-date Brief 5.5 close-out's MissingKnowledgePrompt fix and are NOT named in the brief's "Files in scope" for D2 (singular: `src/components/shared/MissingKnowledgePrompt.tsx`). The brief's "Surgical edits only" principle takes precedence over the broad-acceptance bullet — these four are flagged as a follow-up in D5, not silently inverted in this brief.

---

## D3 — Pre-existing noise locations

### `src/components/results/DriversSection.tsx`

| Line | Item | Context | Disposition |
|---|---|---|---|
| 169 | `// TODO: wire to edge update in future` | Inside `ContestedDriverQuickSelect` `handlePresetClick` | Convert to plain comment — preset click is currently UI-only by design; not a near-term work item |
| 175 | `// TODO: wire to edge update in future` | Inside `ContestedDriverQuickSelect` `handleInputChange` | Convert to plain comment — same rationale |
| 692 | `(window as any).__OLUMI_DEBUG` | Diagnostic gate inside `useEffect` | Type-augment `Window` interface with `__OLUMI_DEBUG?: boolean`; remove the cast |
| 693 | `console.warn('[DriversSection] Data diagnostic:', ...)` | Gated on `__OLUMI_DEBUG` | Keep — runtime-gated diagnostic. Add a comment line explaining the gate |

### `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx`

| Line | Item | Context | Disposition |
|---|---|---|---|
| 1210 | `console.debug('[PreAnalysis] pickStartHere', ...)` | Already gated on `import.meta.env.VITE_DEBUG_PREANALYSIS !== '1'` early-return + already carries an `eslint-disable-next-line no-console` directive immediately above | **No change needed** — already conforms to the brief's "if gated… acceptable" rule |

---

## Stash list

**Length:** 28 entries.

Top 5:

```
stash@{0}: On staging: 5.7-pre: layout WIP
stash@{1}: On staging: WIP: SeverityStyledCritiques test text update - unrelated to useconversation diagnosis
stash@{2}: On ui/ai-panel-tranche-1: pre-brief-4-switch: ai-panel-tranche-1 WIP
stash@{3}: On staging: pre-investigation tracked changes
stash@{4}: WIP on staging: 867642a7 docs(audit): add AI experience + LLM context assembly audits
```

Stash@{0} is now redundant — the layout WIP it preserved landed on staging as commit `cbba3821` (the layout commit that staging moved forward to during the Brief 5.7 run). It can be safely dropped as part of D4 if Paul approves the broader cleanup.

D4 will read `docs/brief-5_5-closeout-stash-triage.md` and present the table.

---

## Acceptance for D1

- [x] Branch `ui/brief-5_7-closeout` created from `origin/staging` (`6e766e58`)
- [x] Typecheck clean
- [x] Scoped vitest counts captured (1559/13/0)
- [x] Brief 5.7 CI run located and recorded — failure on `.nvmrc` step, full suite skipped, infrastructure issue pre-dating Brief 5.7
- [x] MissingKnowledgePrompt `@/canvas` imports → zero
- [x] D3 noise items located with line numbers and disposition
- [x] Stash list length captured (28; one entry now redundant)
