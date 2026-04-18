# Regression Investigation Findings

**Date:** 2026-04-18  
**Branch:** ui/test-cascade-findings-v2  
**Scope:** Three questions raised from cascade-findings-v2. Investigation only — no fixes applied.

---

## Question 1 — `sanitizeMarkdown` intent

### Finding: deliberate, intentional change

**Commit:** `2d88c8cf` — 2026-03-19  
**Subject:** `feat(conversation): Brief A+B — orchestrator rendering v2, chip role differentiation, P0/P1 fixes`  
**Relevant excerpt from commit message:**
> Brief A — SafeRichText, commentary collapse, review card tone:
> - Replace DOMPurify/marked with safeRichText (allowlist: strong, br, ul, li)

This was a deliberate architectural decision made as part of Brief A+B. The markdown pipeline was intentionally changed from full GFM rendering (DOMPurify + marked) to a restricted allowlist renderer (`safeRichText`).

### What `sanitizeMarkdown` does now vs before

| Behaviour | Before (`DOMPurify + marked`) | Now (`safeRichText`) |
|---|---|---|
| `*italic*` | `<em>italic</em>` | `*italic*` (unchanged) |
| `# Heading` | `<h1>Heading</h1>` | `<strong>Heading</strong>` |
| `` `code` `` | `<code>code</code>` | `` `code` `` (unchanged) |
| `\`\`\`...` | `<pre>...</pre>` | raw text with `<br>` |
| `> quote` | `<blockquote>` | `&gt; quote` (escaped) |
| `**bold**` | `<strong>bold</strong>` | `<strong>bold</strong>` ✓ |
| `- item` | `<ul><li>item</li></ul>` | `<ul><li>item</li></ul>` ✓ |
| `<script>alert("xss")` | stripped by DOMPurify → no "alert" | escaped to `&lt;script&gt;alert(…)` — "alert" still present as text |

**XSS contract changed:** DOMPurify _strips_ dangerous tags (no `alert` in output). `safeRichText` _escapes_ all HTML first, then allows only `strong`, `br`, `ul`, `li`. The word "alert" survives HTML-escaping because it's not a tag — it's text content. The XSS risk is still mitigated (the script cannot execute), but the test's assertion `not to contain 'alert'` fails.

### Current call chain (all production callers now receive `safeRichText`)

```
BaseNode.tsx
  → src/lib/renderSafeRichText.ts (sanitizeMarkdown export)
      → src/canvas/utils/markdown.ts  ← @deprecated shim
          → src/canvas/utils/safeRichText.ts (safeRichText)

MessageBubble.tsx, GraphPatchBlockRenderer.tsx
  → src/canvas/utils/safeRichText.ts (direct import)
```

**Stale comment risk:** `src/lib/renderSafeRichText.ts` still documents `sanitizeMarkdown` as using "DOMPurify + marked" — that comment is incorrect. `BaseNode.tsx` has an ESLint disable comment saying `sanitised via DOMPurify (sanitizeMarkdown)` which is also stale. Both are documentation debt, not runtime risk.

### Is it user-visible?

Yes. `BaseNode.tsx` uses `sanitizeMarkdown` to render node `description` fields as `innerHTML`. Nodes with headings (`#`), italic (`*`), or code (`` ` ``) in their descriptions will display raw markdown syntax instead of formatted HTML. This is the intended behaviour post-Brief-A: plain-text-safe rendering with only bold and lists allowed.

### CC assessment

The `markdown.spec.ts` test is **stale** — it was written against the old DOMPurify/marked contract. The production change was intentional and deliberate. **Fix is test-only:** rewrite `markdown.spec.ts` to test `safeRichText` behaviour (headings → `<strong>`, no `<em>`/`<code>`/`<pre>`/`<blockquote>`, XSS via escape-not-strip). 26 tests, all same root cause.

---

## Question 2 — `batchUpdateNodes` replacement

### Finding: function was NOT removed — test mock is incomplete

**`batchUpdateNodes` is alive in `store.ts`** at lines 454 (type) and 1323 (implementation). It was never removed.

**What actually happened — timeline:**

| Date | Commit | Event |
|---|---|---|
| 2026-04-10 | `7aa6259f` | `integratedPath.brief2026-04-10.spec.ts` created. Mock for `useCanvasStore` does NOT include `batchUpdateNodes` (function didn't exist yet). |
| 2026-04-14 | `a1b68fcf` | `batchUpdateNodes` added to `store.ts`. Simultaneously, `backfillInterventionsOntoOptionNodes` in `applyDraftResult.ts` updated to call it. Test mock not updated. |

**Commit `a1b68fcf` message (excerpt):**
> Intervention backfill routes through a new diff-aware `batchUpdateNodes` action, making undo/redo revert affected option nodes in one step.

**Failure path:**
```
integratedPath test
  → backfillInterventionsOntoOptionNodes (applyDraftResult.ts)
      → useCanvasStore.getState().batchUpdateNodes(patches, 'backfill-interventions')
          ← mock getState() returns object WITHOUT batchUpdateNodes
              ← TypeError: batchUpdateNodes is not a function
```

The call in `applyDraftResult.ts:384`:
```ts
useCanvasStore.getState().batchUpdateNodes(patches, 'backfill-interventions')
```

### Are there production callers that would error at runtime?

No. `batchUpdateNodes` exists in the real store. The production path is:
1. `backfillInterventionsOntoOptionNodes` calls it correctly.
2. `applyDraftResult.spec.ts` mocks it correctly (that spec was updated when `a1b68fcf` landed).
3. Only `integratedPath` has the stale mock.

### CC assessment

**Fix is test-only:** Add `batchUpdateNodes` to the `mockGetState` object in `integratedPath.brief2026-04-10.spec.ts`. The mock needs to apply patches to `storeNodes` so Task 2's assertion (`node.data.interventions` populated) can pass. The existing `setState` mock in that file shows the pattern to follow.

---

## Question 3 — V14.3 `.message` contract

### Finding: two distinct cases requiring different fixes

#### Case A — `AdvancedSection.tsx` (intentional addition, needs allowlist entry)

**Commit:** `b462f7e6` — 2026-04-17 10:13  
**Subject:** `fix(analysis): surface inference warnings in trust narrative on the active path`  
**Commit message excerpt:**
> (verbatim messages, AlertTriangle icon per row, cap 3 visible with Show-all overflow) inside the trust-narrative region — placed above the existing model-adjustments pointer and the simplified-model caveat.

**What was added (AdvancedSection.tsx ~line 283):**
```tsx
<span>{w.message}</span>
```
where `w` is from `inferenceWarnings?: Array<{ code: string; message?: string }>`.

**Is this the same exception class as ChallengeSection?** Yes. The commit context confirms these are ISL inference warnings (not PLoT critique data). `ChallengeSection.tsx` was already allowed via `DEFENCE_IN_DEPTH_FILES` with guard `Inference warning.*warning\.code`. `AdvancedSection` renders the same type of data via the same pattern, but was not added to the allowlist.

**V14.3 scanner exclusion check:** The scanner in `no-message-render.spec.ts` explicitly excludes files in the `Advanced/` subdirectory (line 30: `entry === 'Advanced'`) — but `AdvancedSection.tsx` lives directly in `src/components/results/`, not in a subdirectory named `Advanced`. The exclusion doesn't apply.

**CC assessment:** The production change is intentional and correct for the use case. **Fix is test-only:** Add `AdvancedSection.tsx` to `DEFENCE_IN_DEPTH_FILES` in `no-message-render.spec.ts` with an appropriate guard pattern (e.g. verifying `INTERNAL_PATTERN` or the inference-warning filter is still present).

---

#### Case B — `ConfidenceSection.tsx` (archived component, pre-dates V14.3)

**Commit that added `.message` render:** `3702e773` — 2026-04-17 00:17  
**Subject:** `feat(analysis): conditional winners + model adjustments + inference warnings`  
**What was added:** `<span>{w.message}</span>` at ~line 1182.

**Commit that archived the component:** `c88d5967` — 2026-04-17 12:23 (same day, later)  
**Subject:** `docs(analysis): mark ConfidenceSection as archived, not rendered`  
**Commit message excerpt:**
> ConfidenceSection has no production render path — it's imported only by test files that treat it as a legacy integration fixture for assertions that pre-date the DecisionConfidencePanel rewrite.
> Deletion is deferred until those specs are rewritten against the active components.

**Timeline on 2026-04-17:**
1. `3702e773` (00:17) — `.message` render added to ConfidenceSection
2. `c88d5967` (12:23) — ConfidenceSection explicitly archived

**Is it user-visible?** No. The component has no production render path per `c88d5967`. It exists solely as a test fixture for legacy specs.

**CC assessment:** The V14.3 scanner was not updated when ConfidenceSection was archived. It scans archived code and correctly identifies a real `.message` render — but there's no production risk since the component is never mounted. **Fix is test-only:** Exclude `ConfidenceSection.tsx` from the V14.3 scan (add it to the `entry === 'Advanced'` exclusion list or add it to `DEFENCE_IN_DEPTH_FILES`). The cleaner fix is exclusion since the component is explicitly documented as archived.

---

## Summary for Paul

All three questions have **test-only fixes** — no production code change needed.

| # | Root cause | Production impact | Fix scope |
|---|---|---|---|
| Q1 `sanitizeMarkdown` | Deliberate switch from DOMPurify/marked to `safeRichText` in Brief A+B (`2d88c8cf`, 2026-03-19). Test was written against old contract. | User-visible: node descriptions with `# headings`, `*italic*`, `` `code` `` render as raw text. XSS is still blocked (escape, not strip). | Test-only: rewrite `markdown.spec.ts` against `safeRichText` contract. 26 tests, one root cause. |
| Q2 `batchUpdateNodes` | Function exists in store (added `a1b68fcf`, 2026-04-14). `backfillInterventionsOntoOptionNodes` updated to call it. `integratedPath` test created 4 days earlier — mock not updated. | None — production path works correctly. | Test-only: add `batchUpdateNodes` mock to `integratedPath` test. 3 tests, one mock entry. |
| Q3 V14.3 `.message` — `AdvancedSection` | Intentional addition (`b462f7e6`, 2026-04-17): ISL inference warnings, same exception class as ChallengeSection. Not added to `DEFENCE_IN_DEPTH_FILES`. | None — rendering inference warnings is intended. | Test-only: add `AdvancedSection.tsx` to V14.3 allowlist with guard pattern. 1 test. |
| Q3 V14.3 `.message` — `ConfidenceSection` | Archived component (`c88d5967`, 2026-04-17). `.message` added same day as archival. V14.3 scanner not updated to skip it. | None — no production render path. | Test-only: exclude `ConfidenceSection.tsx` from V14.3 scan. 1 test. |

**All 31 tests in these three clusters (26 + 3 + 2) can be fixed without touching any production file.**

The remaining 29 tests across 10 files still require Paul's confirmation of production intent before any fix.
