# Scenario Sandbox MVP: Domain ⇄ TLDraw Mapping Roadmap

- [x] Add feature flag `VITE_FEATURE_SANDBOX_MAPPING` and wire through `FlagsProvider`
- [x] Domain types: `src/domain/graph.ts` with `schemaVersion:1` and KR clamp
- [x] Graph store (React context): `src/sandbox/state/graphStore.ts` with localStorage persistence (debounced)
- [x] Domain → TL mapping (nodes): `src/whiteboard/domainMapping.ts`
- [x] Palette (nodes only): `src/whiteboard/Palette.tsx`
- [x] Wire Combined route with `GraphProvider` behind flag
- [x] Wire Canvas: register mapping on mount; expose mapping via `onAPIReady`; rebuild on graph change
- [x] Tests: node upsert unit; graph persistence reload
- [x] Domain → TL mapping (edges): connectors create/update/remove; default kind='supports'
- [x] TL → Domain listener registration (create/rename/move/resize/delete/connect); incremental diff + rAF batching; origin guard; telemetry add/update/delete
- [x] Inspector Panel: edit Node title/notes/KR; Edge kind/notes; debounced save; quick kind toggle
- [x] Tests: edge mapping unit; inspector node edit (RTL)
- [x] Tests: end-to-end persistence reload includes connectors; TL→Domain incremental sync
- [x] Compare UI (V1): header actions, chooser, two read-only canvases, diff chips, telemetry
- [x] AI Draft (V1): Palette button, prompt sheet, deterministic stub, single-undo apply, telemetry
- [x] What-If & Focus (V1): non-destructive overrides, focus mode toggle + ESC, overlays, score Δ, compare "Current (with what-ifs)", a11y, telemetry, deterministic tests
- [ ] Docs update as features complete (ongoing)

Next:
- [x] Explain Score Δ (V1): gated by `VITE_FEATURE_SANDBOX_EXPLAIN`; link from ScorePill when Δ ≠ 0; side panel shows before/after + Δ and top contributors; keyboard/aria; open/close telemetry; UI-only, non-persistent.
- [x] Presence Idle (V1): gated by `VITE_FEATURE_SANDBOX_PRESENCE`; idle after 45s; fade + “(idle)” suffix; non-blocking overlay; telemetry idle/active (rate-limited); tests + docs.

Notes:
- TL remains renderer, domain is source of truth.
- In-memory `nodeId/edgeId ↔ shapeId` maps only; do not persist shape Ids.
- Register TL listeners once; cleanup on unmount; use official TL APIs so undo/redo works.
- KR badge: single largest |Δ| chip with `title` tooltip; fail-soft if TL UI changes.
- Telemetry: `sandbox_graph_*` name-only with `{ decisionId, route:'combined', sessionId }`.
 - Delete events added for node and edge.
 - Compare UX: two read-only canvases, mapping rebuilds from static Graph inputs; diff chips via `[data-dg-diff="true"] [data-dg-diff-chip]` attributes; TL native UI visible.
 - AI Draft UX: gated by `VITE_FEATURE_SANDBOX_AI_DRAFT`; Palette button opens prompt sheet; generated nodes/edges tagged via `meta.generated=true`.
