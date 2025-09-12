# Sandbox State

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

## AI Draft Scenario (V1)
- Flag: `VITE_FEATURE_SANDBOX_AI_DRAFT`
- UI: Palette shows a "Draft with AI" button. Clicking opens a small sheet with a prompt textarea and Draft button.
- Generation: deterministic stub in `src/sandbox/ai/draft.ts` produces ~4–8 nodes and ~4–10 edges, tagged with `meta.generated=true`.
- Apply: `applyDraft(draft)` inserts all nodes/edges in one undo group, deduping by type+title; recenters viewport to the draft bbox; toast confirms; Undo removes generated items.
- Inspector: shows an "AI" chip when `node.meta.generated` is true.
- Telemetry: emits `sandbox_graph_ai_draft` with `{ countNodes, countEdges }`.
