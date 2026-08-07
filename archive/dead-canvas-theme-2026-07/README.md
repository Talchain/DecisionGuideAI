# Archived: dead canvas node theme (2026-07-18)

`nodes.ts` moved here from `src/canvas/theme/` after a full reference
census at staging `b4c38a1a` found **zero live references** — no static
import, no lazy `import()`, no JSX use, no re-export, no string
reference. Follows the precedent set by
`archive/dead-canvas-components-2026-07/` (commit `a79e8d29`).

## The census

Searched the whole repo (excluding `node_modules`, `.git`, `dist`) for
the module path and for every symbol it exports:

| Pattern | Hits outside `nodes.ts` itself |
|---|---|
| `theme/nodes` | docs + generated reports only — `ds-compliance-report.md`, `docs/Design/Olumi_Design_System_v4.md`, `_v5.md`, `docs/archive/pr-notes/PR4_FEEDBACK_ADDRESSED.md`, `DESIGN_SYSTEM.md`, `scripts/isolation-results/external-files.txt` |
| `getNodeTheme` | none |
| `NODE_SIZES` | none |
| `NODE_SHADOWS` | docs only (`PR4_FEEDBACK_ADDRESSED.md`) |
| `NODE_TRANSITIONS` | none |
| `NodeThemeTokens` | none (declared and used only within the file) |
| `nodeThemes` | none |
| `from '…theme/nodes'` | none |
| dynamic `import()` of a theme module | none |

There is no barrel (`src/canvas/theme/index.*`) that could re-export it.

**Positive control for the search:** its sibling `src/canvas/theme/edges.ts`
IS live and the same patterns find it immediately —
`src/canvas/edges/StyledEdge.tsx:28` imports `applyEdgeVisualProps`, plus
four specs that `vi.mock` it. A search that finds the live sibling would
have found a consumer of `nodes.ts` if one existed.

Canvas nodes style themselves with Tailwind classes (`bg-panel-border`,
`bg-info`, …) resolved through `tailwind.config.js`, not through this
module.

## Why archived rather than retinted

The file was found by the `var(--…)` resolution census: 8 of its token
references (`--info-50/100`, `--success-50/100`, `--lilac-50/100`,
`--node-factor-bg`, `--node-factor-border`) name custom properties that
are defined nowhere, so they always fell through to their hardcoded hex
fallbacks. Repointing them at real tokens would have meant making eight
colour decisions for a module nothing renders — inventing the appearance
of a surface no user can see. Archiving states the honest finding
instead.

`archive/` sits outside the `src/` globs of `tsconfig.app.json`
(`"include": ["src"]`), `tsconfig.ci.json`, and `vitest.config.ts`, so
the file leaves the typecheck, the test run, and the DS deviation
metrics without any config change — the same route `a79e8d29` used.

## Resurrection

`git mv` the file back to `src/canvas/theme/nodes.ts` and re-run the
census on its imports — and fix the eight dangling token references
before wiring it to anything, or it will ship those fallback hexes.
Full pre-archive history:
`git log --follow -- 'archive/dead-canvas-theme-2026-07/nodes.ts'`.

Archived at staging tip `b4c38a1a` by the UI/Experience workstream.
