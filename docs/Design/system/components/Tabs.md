# Tabs

The right-hand panel's tab strip: Olumi, Analysis, Reasoning, Compare, Model and Team.

**Status: built.**

## Anatomy

- **Strip**: 45px high. Six tabs at most; Journey is not a tab.
- **Tab**: a 44px-high `role="tab"` button, in `viewPanelMeta`. An unselected tab is its icon alone. The icons are `olumi-mark`, `tab-analysis`, `tab-reasoning`, `tab-compare`, `tab-model` and `team`.
- **Selected**: `SELECTED`. The tab gets an `h-8` pill, `rounded-full`, with a 1px `text-header` ring, `bg-panel-hover`, and `text-header` at 500, and it shows its label.
- **Focus**: a 2px ring in `text-header`.

## Code

- `src/canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx`
- `src/canvas/components/workspaceShell/shellContract.ts`
- `src/styles/selected.ts` (`SELECTED`)

This preview is a static rendition at UI `9aa1b195`.
