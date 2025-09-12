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

## Storage Keys
- Domain graph (canonical for mapping): `dgai:graph:decision:${decisionId}`
- TL snapshot (UI-only; existing): `dgai:canvas:decision/${decisionId}`
- Combined route UI prefs (existing):
  - `dgai:combined:${decisionId}:panel_w`
  - `dgai:combined:${decisionId}:panel_collapsed`
  - `dgai:combined:${decisionId}:style_open`
  - `dgai:combined:${decisionId}:active_tab`
