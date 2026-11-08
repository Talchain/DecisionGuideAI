# Lane C (PL-22): how the alpha View screen depends on the old canvas, and the order to cut it

DGAI `c6e1186c963f4cfcc8a565d06639768301676308` (poc/r25-ui as the DL named it), 8 Nov 2026. Read-only measurement in
`~/olumi-work/worktrees/dgai-arch-view-validate`. Full per-module table: `laneC-import-map-raw.md` (same folder).

## Verdict
- **73 import statements from 23 production files in `src/olumiView` reach 42 distinct `src/canvas` modules.** The PL counted
  64 → 43 at 257bdb9f. So in one day the coupling grew by 9 statements, while one module dropped out.
  - Re-derived here: rg, prod `.ts/.tsx` only (no `__tests__`, fixtures or specs); 0 dynamic imports; 0 `@/canvas` hits.
  - Contrast: the same probe finds 43 imports into `src/olumiCore`.
- **17 modules (24 statements) are shared primitives; 25 modules (49 statements) carry old state.**
- **The coupling runs both ways.** `src/canvas` makes 34 imports back into `src/olumiView`, from 8 files (OutputsDock 10, ViewCardNode 9,
  ViewLinkEdge 5, ViewQuestionNode 3, …).
- **The root is the View's own bridge.** `src/olumiView/canvas.ts:9` imports `useCanvasStore`, the old 9,120-line store
  (`src/canvas/store.ts:3450`), and reads `useCanvasStore.getState().nodes` (:59). Nine View files import that store.

## Shared primitives (move to a neutral module; old canvas re-imports from there, no copies)
- **Copy and constants:** lensKeyCopy, whatIfCopy, domain/vocabulary, nodeTooltip.
- **Geometry and camera:** wrapTiers, orderUnderParents, computeFitPadding, cameraComfort, fitIntoFreePane, canvasGlyphScale.
- **Presentational:** NodeShapeIndicator, model-tab-v2/rowPresentation, Conversation.module.css.
- **ViewQuestionNode:** a View component stored in canvas.
- **Registries (move the channel, not just the import):** askTargetBinding (`let pending`), dockedOlumiFocus (`let registered`),
  unboundModelBinding (returns the old store's patch shape).

## Old-state dependencies (by importer count)
- **canvas/store** (`useCanvasStore`): 9 files.
- **utils/focusHelpers**: 6 (store at :10).
- **artefacts/lenses**: 5, constants only (store at :19).
- **components/CanvasOverlayBand**: 4 (via FloatingOlumiPanel → store).
- **Two each:** guidanceStore (zustand, imports v5), ViewCardNode, DecisionBriefTrigger, FloatingOlumiPanel.
- **Mounted from ViewCanvas:**
  - OutputsDock (4,710 lines);
  - ReactFlowGraph's `MaybeConversationProvider` (the flag-gated old CEE conversation);
  - OptionChanceCellProvider (→ useResultsSectionData → useSwitchFactorNodes → store);
  - HighlightContext, OlumiAttentionCard and ToastContext.
- **Other old areas:** `store/scenarios.setCurrentScenarioId` (old localStorage document model, thinClient, CEE/PLoT types);
  `src/stores/uiStore` (4 direct imports); `utils/layout` depends on the old graph schema `domain/nodes.NODE_REGISTRY`.

## Proposed cut order (one PR each, LOW tier, pure moves first)
0. **The View is checked at the entry** (PL-21, `wip/arch-view-validate`). Every later cut can then rely on a valid View instead of
   defensive reads.
1. **Hoist the constants the View borrows from old-state modules** (~14 statements, no behaviour change):
   - `REACT_FLOW_DELETE_KEY_CODE` (= `null`), `DECISION_BRIEF_TRIGGER_LABEL` (= `'Summary'`), `OVERLAY_BAND_*`, `LENS_COPY` / `LENS_ICON`;
   - `measureDockInset` (DOM only);
   - LensBar's placement helpers. These are UNVERIFIED as pure: check before moving.

   Move each into a neutral module that both sides import.
2. **Move the shared primitives and the two self-contained providers** (LayerProvider, ToastContext) to that neutral module. Also
   `AIInputBar`'s type: it is a type-only import with no runtime link.
3. **Bring the three View components home** (ViewCardNode, ViewQuestionNode, ViewLinkEdge → `src/olumiView`). That removes 17 of the
   34 back-imports. ViewCardNode's own `useCanvasStore` read goes in the same PR.
4. **Cut the bridge:** `olumiView/canvas.ts` reads the View's own store, not `useCanvasStore`. Then cut the other eight store importers
   one by one: note, AddFigure, Spine, Rack, tabRing, v10, ViewChat, ViewCanvas. focusHelpers (6) follows, targeting the View's own
   React Flow instance.
5. **The registries** (askTargetBinding, dockedOlumiFocus, unboundModelBinding): end each shared channel, or move it to the neutral module.
6. **The hard mounts in ViewCanvas:**
   - OutputsDock, MaybeConversationProvider, OptionChanceCellProvider, HighlightContext, NodeCornerOlumi, OlumiAttentionCard;
   - guidanceStore, askSemantic, revealOlumi;
   - store/scenarios and uiStore.

   Each needs a View-owned replacement or removal. Some are product calls (the dock). UNVERIFIED: whether these mounts are what keeps
   the bundle at 9.84 MB. Measure the bundle after each cut, not before.
7. Then lane C's step 3, extracting the figure edit card into a small package, can draw only on the step 1–2 neutral module.

## Pairing hazard found while building PL-21 (affects every cut)
- The served pair at core `043895af` vendors DGAI `257bdb9f` (`ui-dist/BUILD.json`). That DGAI's schema is core 6192ad6b's, which is
  older than the core it is served with. Core adds `draft`, `next`, `chip`, `kind` and `about`.
- 22 of the 29 View JSON files under `src/olumiView/golden` and `fixtures` fail core's schema, mostly hand-built older shapes.
  About 30 specs feed View JSON through `readView`.
