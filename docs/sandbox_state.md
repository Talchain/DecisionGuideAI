# Sandbox State
## Export / Import JSON (UI-only)
- Flag: `VITE_FEATURE_SANDBOX_IO` (default OFF)
- Location: Combined header cluster under `data-dg-io`.
- Export JSON:
  - Serializes the canonical domain graph via `serializeGraph(decisionId, graph)`.
  - Downloads `decision-<id>-graph.json`.
  - Telemetry: `sandbox_io_export { decisionId, route:'combined', sessionId, nodeCount, edgeCount }`.
- Import JSON:
  - File input opens; payload is parsed, validated, normalized via `normalizeGraph`.
  - Applies by replacing local storage and `GraphProvider.reloadFromStorage()` in one undo group with a pre-apply snapshot.
  - Announces via a polite live region: “Imported N nodes, M links”. Also toasts.
  - Telemetry: `sandbox_io_import { nodeCount, edgeCount }`.
- Overlays remain non-blocking; controls have clear `aria-label`s.

## Quickstart Templates (UI-only)
- Flag: `VITE_FEATURE_SANDBOX_TEMPLATES` (default OFF)
- Location: Combined header “Templates ▾” menu under `data-dg-template`.
- Applying a template:
  - Normalizes a typed graph from `src/sandbox/templates/`.
  - Takes a snapshot backup, replaces storage, reloads graph, announces politely, and shows a toast.
  - Telemetry: `sandbox_template_apply { templateId, nodeCount, edgeCount }`.
- Templates are tiny starter graphs (2–5 nodes) with positions in `view`.
## Explain Score Δ (V1)
- Flag: `VITE_FEATURE_SANDBOX_EXPLAIN` (default OFF)
- Entry: `ScorePill` shows an "Explain Δ" link when flag ON and `(Δ ≠ 0)`.
- Panel: `ExplainDeltaPanel` is a small side panel (non-modal) with `role="region"` and a heading. It opens from the link and can be closed with the "Close" button or `Esc`.
  - The panel has its own `aria-live="polite"` for open/close announcements only. The score live region remains in `ScorePill` (there is one and only one score live region).
- Highlight overlay: clicking a contributor row emits a transient highlight ring over the corresponding node on the canvas.
  - Overlays are non-blocking and use stable tags: `data-dg-explain="true"` on the panel root and `data-dg-explain-highlight` on the canvas root (and `[data-dg-explain-overlay]` for the overlay container).
- Telemetry: name-only, emitted once per open/close with standard meta `{ decisionId, route:'combined', sessionId }`.
  - `sandbox_score_explain_open`
  - `sandbox_score_explain_close`


## Presence Idle (V1)
- Flag: `VITE_FEATURE_SANDBOX_PRESENCE` (default OFF)
- UX:
  - A collaborator is considered idle after 45s of no interaction (document-level `pointermove`, `keydown`, `wheel`, `mousedown`, `focusin` reset the timer).
  - When idle: avatar/name fade to ~50% opacity; the displayed name is suffixed with "(idle)"; tooltip/title shows "Idle".
  - Stable selectors: `data-dg-presence="idle|active"` on the presence element; overlay root has `data-dg-presence-overlay` and remains non-blocking (`pointer-events:none`).
  - On activity: immediately returns to active state.
- Accessibility:
  - No live region changes for idle; this is decorative only. The single score aria-live in `ScorePill` remains the only live region.
  - Ensure name text remains readable at reduced opacity; contrast verified against light token background.
- Telemetry (name-only, no PII; rate-limited to once per 60s per session):
  - `sandbox_presence_idle { decisionId, route:'combined', sessionId }`
  - `sandbox_presence_active { decisionId, route:'combined', sessionId }`
- Testing hooks (available only in tests):
  - From `PresenceProvider`: `__TEST__getPresenceControls(decisionId)?.resetIdleTimer()` to deterministically start/reset the idle timer.
  - From `PresenceOverlay`: `__TEST__presenceOverlayTick()` to request a single re-render tick for time-based visuals.


## Routes
- `/decisions/:decisionId/sandbox/combined` — Panels + Canvas combined route.

## Feature Flags
- `VITE_FEATURE_SCENARIO_SANDBOX`
- `VITE_FEATURE_WHITEBOARD`
- `VITE_FEATURE_SCENARIO_SNAPSHOTS`
- `VITE_FEATURE_DECISION_GRAPH`
- `VITE_FEATURE_OPTION_HANDLES`
- `VITE_FEATURE_COLLAB_VOTING`
- `VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE`
- `VITE_FEATURE_SANDBOX_TRIGGERS_BASIC`
- `VITE_FEATURE_SANDBOX_PROJECTIONS`
- `VITE_FEATURE_SANDBOX_DECISION_CTA`
- `VITE_FEATURE_SANDBOX_REALTIME`
- `VITE_FEATURE_SANDBOX_VOTING`
- `VITE_FEATURE_SANDBOX_DELTA_REAPPLY_V2`
- `VITE_FEATURE_SANDBOX_MAPPING` (new)
- `VITE_FEATURE_SANDBOX_COMPARE` (new)
- `VITE_FEATURE_SANDBOX_AI_DRAFT` (new)
- `VITE_FEATURE_SANDBOX_WHATIF` (new)
- `VITE_FEATURE_SANDBOX_EXPLAIN` (new)
- `VITE_FEATURE_SANDBOX_IO` (new)
- `VITE_FEATURE_SANDBOX_TEMPLATES` (new)

## Storage Keys
- Domain graph (canonical for mapping): `dgai:graph:decision:${decisionId}`
- Snapshot list: `dgai:graph:snap:list:${decisionId}` → `[{ id, name, createdAt }]`
- Snapshot payload: `dgai:graph:snap:${decisionId}:${snapId}` → `Graph`
- TL snapshot (UI-only; existing): `dgai:canvas:decision/${decisionId}`
- Combined route UI prefs (existing):
  - `dgai:combined:${decisionId}:panel_w`
  - `dgai:combined:${decisionId}:panel_collapsed`
  - `dgai:combined:${decisionId}:style_open`
  - `dgai:combined:${decisionId}:active_tab`

## Compare UX (V1)
- Two read-only canvases (Left and Right) mounted in the combined view when Compare is open.
- Each pane rebuilds from a static Graph (Current or a saved snapshot) using the domain→TL mapping.
- Visual diff chips rendered as non-blocking overlays under `[data-dg-diff="true"]`:
  - Node chips via `data-dg-diff-chip="added|removed|changed"` placed near their node.
- TL native UI remains visible; overlays are `pointer-events:none`.

## What-If & Focus (V1)
- Flag: `VITE_FEATURE_SANDBOX_WHATIF`
- Scope: UI-only; does not persist any overrides to storage. The base domain graph remains the source of truth.
- Overrides supported:
  - Disable node/edge toggles (Inspector) — non-destructive, applied on-the-fly to an effective graph used for rendering and scoring.
  - KR overrides (per Outcome): adjust `Δ P50` and `Confidence` via sliders; merged (clamped) into an effective graph without mutating the base.
- Focus Mode:
  - Toggle focus on the selected node; unrelated nodes are dimmed via an overlay. Escape (Esc) exits focus. Selection changes sync the focused node when active.
  - Focus controls are gated by the same flag. Overlays are non-blocking and use stable data attributes (`data-dg-focus`, `data-testid="focus-dim-<id>"`).
- Overlays:
  - What-If overlay tags nodes/edges that are disabled or overridden, with `pointer-events:none` and stable attributes (`data-dg-whatif="true"`).
  - Focus overlay dims unrelated nodes using non-blocking rectangles.
  - Overlays are non-blocking (`pointer-events:none`) and rely on stable data attributes for tests.
- Score Δ:
  - `ScorePill` computes the scenario score against the effective graph when overrides exist and shows a delta `(Δ ±N)` relative to the base graph.
  - A single `aria-live="polite"` region in `ScorePill` announces score changes and deltas. Emission of `sandbox_whatif_score_update` is debounced to avoid spam during slider drags.
- Compare source:
  - Adds a "Current (with what-ifs)" source token (`current_whatif`) to Compare. When selected, the left/right pane rebuilds from the effective graph (flag-gated) with `data-dg-whatif="true"` on the pane root for styling/testing.

### Accessibility notes
- Inspector controls use stable accessible names:
  - "Disable node (what-if)", "Disable link (what-if)", and "Reset all what-ifs".
- Focus toggle buttons expose `aria-pressed` for state. Enter/Space activate via native button semantics.
- Overlays are non-blocking (`pointer-events:none`) and rely on stable data attributes for tests.

## AI Draft Scenario (V1)
- Flag: `VITE_FEATURE_SANDBOX_AI_DRAFT`
- UI: Palette shows a "Draft with AI" button. Clicking opens a small sheet with a prompt textarea and Draft button.
- Generation: deterministic stub in `src/sandbox/ai/draft.ts` produces ~4–8 nodes and ~4–10 edges, tagged with `meta.generated=true`.
- Apply: `applyDraft(draft)` inserts all nodes/edges in one undo group, deduping by type+title; recenters viewport to the draft bbox; toast confirms; Undo removes generated items.
- Inspector: shows an "AI" chip when `node.meta.generated` is true.
- Telemetry: emits `sandbox_graph_ai_draft` with `{ countNodes, countEdges }`.
