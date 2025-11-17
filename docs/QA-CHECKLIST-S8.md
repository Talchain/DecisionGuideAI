# S8 QA Checklist — Docked Layout, Help, and Delete Feedback

Tick each item after verifying in both DOM/unit tests and Playwright E2E (where applicable).

- [ ] **Dock state persistence (Inputs)**  
  - Inputs dock open/close state persists across reloads via `useDockState` + `sessionStorage`.  
  - Active tab (Documents / Scenarios / Limits & health) persists and is announced via `aria-live`.

- [ ] **Dock state persistence (Outputs)**  
  - Outputs dock open/close state persists across reloads via `useDockState`.  
  - Active tab (Results / Insights / Compare / Diagnostics) persists and is announced via `aria-live`.

- [ ] **Layout offsets & collapse/expand**  
  - With `VITE_FEATURE_INPUTS_OUTPUTS` disabled, ReactFlow canvas uses full width (no CSS offsets).  
  - With the feature enabled, ReactFlow wrapper `left`/`right` use `var(--dock-left-offset)` / `var(--dock-right-offset)`.  
  - Collapsing/expanding Inputs dock updates `--dock-left-offset` between expanded and collapsed tokens.  
  - Collapsing/expanding Outputs dock updates `--dock-right-offset` between expanded and collapsed tokens.

- [ ] **Keyboard legend open/close**  
  - Pressing `Shift+/` (`?`) opens the **Keyboard legend** dialog from the canvas.  
  - Dialog has correct ARIA (`role="dialog"`, `aria-modal="true"`, labelled by "Keyboard legend").  
  - `Escape` and the "Close keyboard legend" button both close the panel.  
  - Typing `?` inside inputs or editable fields does **not** toggle the legend.

- [ ] **Delete → filename toast (legacy Documents drawer)**  
  - With dock layout **OFF** (`feature.inputsOutputs = '0'`), `Cmd/Ctrl + D` toggles the legacy Documents drawer.  
  - Upload `legacy-delete.txt` via the drawer, delete it, and confirm a toast appears containing `"legacy-delete.txt removed"` (or equivalent copy including the filename).  
  - No console errors during this flow.

- [ ] **Delete → filename toast (docked Inputs → Documents)**  
  - With dock layout **ON** (`feature.inputsOutputs = '1'`), `Cmd/Ctrl + D` focuses Inputs → Documents instead of the legacy drawer.  
  - Upload `docked-delete.txt` in the docked Documents manager, delete it, and confirm a toast appears containing `"docked-delete.txt removed"`.  
  - No console errors during this flow.

- [ ] **Degraded banner behaviour**  
  - When the degraded banner feature is enabled and the health probe reports `status: 'degraded'`, the banner appears with appropriate copy beneath the header.  
  - When `status: 'down'`, the banner shows the "engine unavailable" message.  
  - When `status: 'ok'` or the probe fails, no degraded banner is shown.

- [ ] **Docs & flags wired correctly**  
  - `.env.example` documents `VITE_FEATURE_INPUTS_OUTPUTS`, `VITE_FEATURE_COMMAND_PALETTE`, and `VITE_FEATURE_DEGRADED_BANNER` as commented defaults.  
  - `FEATURES_OVERVIEW.md` has an S8 section describing docked layout insets, keyboard legend behaviour, document delete feedback, and degraded-mode banner behaviour.  
  - This checklist stays in sync with the S8 tests (DOM + E2E) and feature flags.
