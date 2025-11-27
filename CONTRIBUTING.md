# Contributing to DecisionGuideAI

Thank you for contributing — this document captures a few critical engineering constraints and practices that are easy to miss during reviews.

## React 18, Zustand, and React #185

The canvas experience uses React 18 and Zustand. We previously hit React error #185 ("Maximum update depth exceeded") due to unsafe selector patterns. To prevent regressions:

### 1. Banned patterns in `src/canvas/**`

- **Do not use `zustand/shallow` in canvas code.**
  - Banned import:
    - `import { shallow } from 'zustand/shallow'`
  - Rationale: combining object selectors + `shallow` + React 18's `useSyncExternalStore` led to render loops.

- **Do not select plain objects from `useCanvasStore`.**
  - Banned pattern:
    - `const { nodes, edges } = useCanvasStore(s => ({ nodes: s.nodes, edges: s.edges }))`
  - Instead, use individual selectors:
    - `const nodes = useCanvasStore(s => s.nodes)`
    - `const edges = useCanvasStore(s => s.edges)`
  - Or, where appropriate in non-render paths, use `useCanvasStore.getState()`.

> These rules are enforced by ESLint and a CI guard script, but reviewers should still explicitly look for them.

### 2. The only allowed shallow usage

- `src/canvas/components/OutputsDock.tsx` contains a carefully-audited `useShallow` pattern.
- This file is explicitly whitelisted in the ESLint + CI guardrails.
- If you need a new multi-field selector, prefer individual selectors or store getters; do **not** copy this pattern elsewhere.

### 3. Debugging React #185 if it ever recurs

- Enable state debug mode by adding `?stateDebug=1` to the URL.
- When an error occurs:
  - Canvas error boundaries write structured events into `window.__SAFE_DEBUG__.logs`.
  - Use the "Copy debug info" button in the UI to capture:
    - The error message and stack
    - Recent `canvas:set` store mutations
    - Misc boot and routing metadata
- In most past incidents, the problem was a selector/equality issue, not an excessive number of `set` calls.

## Global error & debug logging

- `src/main.tsx` bootstraps `window.__SAFE_DEBUG__` and now:
  - Persists the last ~500 debug log entries to `localStorage`.
  - Captures `unhandledrejection` events as `"unhandledrejection"` log entries.
- When adding new debug events, prefer structured shapes:
  - `{ t, m, data }` where `m` is a short machine-friendly key and `data` is JSON-serializable.

## Memoization & re-render hygiene

Some modules use `useMemo` / `useCallback` for additional protection against unnecessary re-renders (e.g., toast context, influence explainer, onboarding hooks). These are **complementary** to the Zustand selector rules.

When adding new context values or hooks:

- Prefer stable references for value/handler props (`useMemo`, `useCallback`).
- Avoid recreating large object literals in render paths when they are passed to deep subtrees.

If in doubt, add a short comment explaining *why* a particular memoization exists (e.g., "avoid React 185 by keeping callback identity stable for X").

---

If you change any of the above invariants (e.g., upgrading React or Zustand), please update this document and re-run:

```bash
npm run lint
npm run ci:guard:zustand
```

…to ensure the guardrails still hold.
