# UI — DecisionGuideAI

Decision-modelling canvas: build and analyse decision graphs. React / TS / Vite /
Tailwind. Consumes CEE drafts and PLoT/ISL analysis.
Platform map + cross-cutting hazards: repo-parent `CLAUDE.md`. Global git/verify
practice: `~/.claude/CLAUDE.md`.

## Core doctrine: the UI is a passthrough

- **The UI must not transform meaning** — never flip signs, default missing values, or
  clamp ranges to "fix" display. If data looks wrong on screen, **the bug is upstream
  (PLoT or CEE), not here.**
- Every unavoidable semantic transform is tagged `UI-SEM-NNN` in code. **Never add an
  untagged transform** — assign the next ID and add a row. Full register:
  [`docs/UI-SEM-inventory.md`](docs/UI-SEM-inventory.md). Many rows are debt ("Remove when
  PLoT provides…") — the value is fabricated here and belongs upstream.
- **This repo pins an old `@talchain/schemas`** and so silently drops newer fields
  (coaching, evidence have been lost this way). Check the pin before assuming a field
  arrives. See parent map.

## Design system

Quick ref: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). Full spec: [`docs/design/Olumi_Design_System_v4.md`](docs/design/Olumi_Design_System_v4.md). Key rules:

- **Three channels:** Shapes (what it is) · Colour (how it's doing) · Icons (what you can do) — no channel duplicates another.
- `bg-{colour}-light` is for canvas node fills / panel entity-hover only — **never** on cards, banners, pills, coaching cards (use `bg-panel`). Borders via opacity (`border-danger/30`).
- Pills: outlined only (`bg-transparent border-{colour}/30 text-text-body`). Primary button: `bg-primary text-text-on-color`.
- Inter font throughout, Lucide icons only, no emoji in production UI. Use semantic tokens (`text-info`, `bg-panel`), not legacy aliases (`sky-500`).

## Architecture: CEE → UI → PLoT data flow

- CEE response → `adaptDraftResponse()` (`src/adapters/cee/client.ts`) → DraftChat node mapping → canvas store → V2 adapter (`transformNodeToV2`, `extractObservedState`) → `normaliseGraphIds` → PLoT request.
- **Naming:** CEE/PLoT use `observed_state` (snake_case); canvas nodes use `observedState` (camelCase). `DraftChat.tsx` maps in; the V2 adapter maps out.
- Key files: `src/adapters/plot/v2/adapter.ts` (request builder), `src/adapters/plot/v2/types.ts`, `src/adapters/cee/types.ts`, `src/canvas/components/DraftChat.tsx`, `src/utils/nodeIdNormalisation.ts`.
- Patterns: `transformNodeToV2` uses a **blocklist** (excludes RF internals, passes through CEE fields); `extractObservedState` **spreads** original then overlays computed defaults; DraftChat destructures + spreads `...rest` to preserve unknown fields. **Preserve unknown fields everywhere** — that's how forward-compatible data survives the version skew.

## Commands

```bash
npm run dev          # dev server (port 5173)
npm run typecheck    # tsc -p tsconfig.ci.json --noEmit
npm run lint
npm test             # vitest run (full — Tier 3)
npm run test:full    # full suite, 6 GB heap (NODE_OPTIONS=--max-old-space-size=6144)
```

## Testing tiers

- **Tier 1 (after every change):** `npm run typecheck` + `npx vitest run --changed --bail=1`. No related tests → typecheck alone.
- **Tier 2 (before commit):** `npm run typecheck` + `npm run lint`.
- **Tier 3 (push to staging only):** `git push origin staging` triggers the **fast** pre-push gate (`scripts/validate-prepush.sh`, ~3 min — typecheck, lint changed, smoke suite, stale-`.js`, dep audit). The full ~6,284-test suite runs **in CI post-push** (`staging-full-tests.yml`). Don't run the full suite locally after every change, and never typecheck + full-test in parallel (doubles peak RAM). For a deliberate local full run: `npm run test:full` or `bash scripts/pre-push-validate.sh`.

> The `@talchain/schemas` `file:` dependency is allowlisted deliberately (v5 A1 policy) and paired with a tarball-SHA manifest check. Any *other* `file:` ref fails the gate. Vitest teardown may emit `ERR_WORKER_OUT_OF_MEMORY` even when all tests pass — treat as success if the summary reports zero failures.

## Deploy

Push to `staging` by default; **never `main` without explicit confirmation.** CI is the authoritative gate (full suite, E2E, coverage, bundle policy, security scans).

## Working rules (shared doctrine, condensed)

- This is a React app: when debugging renders, check stale component state, missing hook deps, bad memoisation — and stale `.js`/`.jsx` shadowing a `.ts`/`.tsx` source.
- **Data-flow tracing before any cross-boundary fix:** origin → every transform/adapter (with paths) → consumer → alternate paths (loading/error/empty states, SSE stream). Fix *all* affected layers.
- **Code-review feedback:** read every item first, judge each independently (valid / already-handled / misunderstanding), state reasoning, don't change correct code to appease.
