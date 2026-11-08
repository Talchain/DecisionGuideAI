# Lane C raw import map: src/olumiView (prod) → src/canvas, DGAI c6e1186c963f4cfcc8a565d06639768301676308

Measured by a read-only Explore agent. The lane session re-derived the totals (73 / 42 / contrast 43) and the `canvas.ts:9` and
`store.ts:3450` lines.

- **Alias:** only `@/` → `src/`. `@/canvas` has 0 hits.
- **Scope:** 68 production files. Excluded: `__tests__`, `fixtures/`, `*.test.*` and `*.spec.*`.
- **Since 257bdb9f:** `git diff --stat 257bdb9f c6e1186c -- src/olumiView src/canvas` = 34 files, +6216 −223.

```
rg -n --no-heading -g '*.{ts,tsx}' -g '!**/__tests__/**' -g '!**/fixtures/**' -g '!*.test.*' -g '!*.spec.*' \
  -e "(from|import)\s*\(?\s*['\"](\.\./)+canvas/[^'\"]*['\"]" -e "(from|import)\s*\(?\s*['\"]@/canvas/[^'\"]*['\"]" src/olumiView
```

## Totals

| Measure | Count |
|---|---|
| Statements | 73 |
| Distinct modules | 42 (41 TS, 1 CSS module) |
| Importing files | 23 |
| Contrast: imports into olumiCore | 43 |
| Reverse imports: canvas → olumiView | 34, from 8 files |
| Type-only imports | `AIInputBar`, plus the inline `type ViewCardData` |

- **Heaviest importers:** ViewCanvas.tsx (16), ViewChat.tsx (8), v10.tsx (6).
- **By class:** PRIMITIVE is 17 modules and 24 statements. OLD-STATE is 25 modules and 49 statements.

## Module table

**Tags:**
- **[registry]**: a module-level mutable channel that is shared with old canvas.
- **[ctx]**: a React context provider.
- **[graph-model]**: depends on the old `domain/nodes` schema.
- **[view-owned]**: a View component that lives in canvas.
- **[const]**: only a constant or DOM helper is used.

| Target (src/canvas/…) | Class | Symbols | Importers | Evidence |
|---|---|---|---|---|
| store | OLD-STATE | useCanvasStore | 9: canvas.ts:9, v10:42, note:8, ViewCanvas:16, reasoning/Spine:22, ViewChat:22, reasoning/tabRing:7, reasoning/Rack:20, AddFigure:17 | create<CanvasState> store.ts:3450; adapters plot/cee, v5, flags, persist, store/scenarios |
| utils/focusHelpers | OLD-STATE | focusNodeById ×5, registerFocusHelpers | 6: model/detail:12, reasoning/tabRing:6, model/LinkRow:10, AddFigure:16, model/ModelCardRow:22, ViewCanvas:18 | useCanvasStore :10; ./olumiAttention |
| artefacts/lenses | OLD-STATE [const] | LENS_COPY, LENS_ICON | 5: ViewTradeOffsKey:12, ViewLensBar:13, Rack:21, ViewPreMortemKey:17, ViewWhatIfKey:16 | useCanvasStore :19; constants :31, :68 |
| nodes/NodeShapeIndicator | PRIMITIVE | NodeShapeIndicator | 4: ViewChances:14, ViewModelTab:22, Spine:23, ModelCardRow:23 | props only; type-only domain/nodes |
| components/CanvasOverlayBand | OLD-STATE (transitive) [const]/[ctx] | OVERLAY_BAND_*; CanvasOverlayBandProvider | 4: ViewTradeOffsKey:11, ViewPreMortemKey:16, ViewWhatIfKey:15, ViewCanvas:24 | :79 → FloatingOlumiPanel:14 → store |
| artefacts/lensKeyCopy | PRIMITIVE | LENS_KEY_COPY | 3 lens keys | copy only |
| stores/guidanceStore | OLD-STATE | useGuidanceStore, withOlumiReveal | 2: model/structure:12, ViewChat:26 | zustand :7/:639; v5 extractPhase3 :19 |
| nodes/ViewCardNode | OLD-STATE [view-owned] | VIEW_CARD_SLOTS, type ViewCardData, ViewCardNode | v10:36, v10:40 | useCanvasStore :23; 9 imports back into olumiView |
| model-tab-v2/rowPresentation | PRIMITIVE | KIND_GLYPH | 2: ViewModelTab:23, LinkRow:11 | types, vocabulary, lucide |
| domain/vocabulary | PRIMITIVE | MODEL_GROUP_TITLE, MODEL_TAB_GOAL_GROUP_TITLE | 2: layout:6, ViewModelTab:21 | constants |
| decisionBrief/DecisionBriefTrigger | OLD-STATE [const] | DECISION_BRIEF_TRIGGER_LABEL ('Summary', :23) | 2: ViewBrief:11, ViewSummary:11 | useCanvasStore :14 |
| components/FloatingOlumiPanel | OLD-STATE [const] | measureDockInset (:565–573, DOM only) | 2: ViewLensBar:10, DraftingBoard:10 | useCanvasStore :14; flags, uiStore |
| utils/wrapTiers | PRIMITIVE | wrapTiers | layout:12 | geometry |
| utils/orderUnderParents | PRIMITIVE | orderUnderParents | layout:14 | geometry |
| utils/layout | OLD-STATE [graph-model] | layoutGraph | layout:11 | NODE_REGISTRY from domain/nodes :69; elkjs |
| utils/olumiAttention | OLD-STATE | clear/requestOlumiAttention, type OlumiAttentionNote | note:9 | useCanvasStore :32 |
| utils/fitIntoFreePane | PRIMITIVE | viewportCentredInFreePane | ViewCanvas:32 | DOM query .react-flow :86 |
| utils/computeFitPadding | PRIMITIVE | computeFitPadding | ViewCanvas:30 | DOM measure |
| utils/cameraComfort | PRIMITIVE | paddingToInsets | ViewCanvas:31 | pure |
| useKeyboardShortcuts | OLD-STATE [const] | REACT_FLOW_DELETE_KEY_CODE (null, :391) | ViewCanvas:17 | useCanvasStore :5 |
| ui/inspector-v2/askTargetBinding | PRIMITIVE [registry] | takeAskTargetBinding | ViewChat:27 | `let pending`, written by askAi, askSemantic, PreMortemWorksheet |
| ui/inspector-v2/askSemantic | OLD-STATE | requestAsk | model/structure:13 | useCanvasStore :5 |
| stores/unboundModelBinding | PRIMITIVE [registry-shape] | scenarioIdWrite | ViewChat:24 | returns the old store's patch shape |
| store/scenarios | OLD-STATE | setCurrentScenarioId | ViewChat:23 | localStorage :293, thinClient :19, CEE/PLoT types :16–17 |
| nodes/shared/nodeTooltip | PRIMITIVE | NODE_TOOLTIP_DELAY_MS | v10:34 | constant |
| nodes/shared/canvasGlyphScale | PRIMITIVE | CANVAS_GLYPH_SIZE_CLASSES | v10:33 | typography |
| nodes/shared/OptionChanceCellProvider | OLD-STATE (transitive) [ctx] | OptionChanceCellProvider | ViewCanvas:27 | :2 → useResultsSectionData:2 → useSwitchFactorNodes:3 → store |
| nodes/shared/NodeCornerOlumi | OLD-STATE | NodeCornerOlumi | v10:41 | useCanvasStore :28 |
| nodes/ViewQuestionNode | PRIMITIVE [view-owned] | ViewQuestionNode | ViewCanvas:19 | no old state one level down |
| highlighting/HighlightContext | OLD-STATE [ctx] | HighlightProvider | ViewCanvas:26 | useCanvasStore :31 |
| edges/ViewLinkEdge | OLD-STATE (transitive) [view-owned] | ViewLinkEdge | ViewCanvas:20 | :16 → olumiView/canvas → store |
| conversation/revealOlumi | OLD-STATE | revealOlumiSurface | ViewPreMortemKey:19 | uiStore :1; flags :3 |
| conversation/dockedOlumiFocus | PRIMITIVE [registry] | registerDockedOlumiFocus | ViewChat:15 | `let registered` |
| conversation/Conversation.module.css | PRIMITIVE | styles | ViewChat:40 | CSS |
| components/OutputsDock | OLD-STATE | OutputsDock | ViewCanvas:22 | 4,710 lines; useCanvasStore :40 |
| components/OlumiAttentionCard | OLD-STATE | OlumiAttentionCard | ViewCanvas:21 | useCanvasStore :45 |
| components/LayerProvider | OLD-STATE [ctx], self-contained | LayerProvider | ViewCanvas:25 | react only |
| components/AIInputBar | type-only | type AIInputBarProps | ViewChat:28 | no runtime link |
| artefacts/whatIfCopy | PRIMITIVE | WHAT_IF_COPY | ViewWhatIfKey:18 | copy |
| artefacts/LensBar | OLD-STATE | LENS_BAR_TESTID, lensBarFitsBesidePill, placeLensBar | ViewLensBar:12 | useCanvasStore :14 |
| ToastContext | OLD-STATE [ctx], self-contained | ToastProvider | ViewCanvas:28 | react, lucide, typography |
| ReactFlowGraph | OLD-STATE | MaybeConversationProvider (:3315) | ViewCanvas:29 | useCanvasStore :15; isAiPanelV2Enabled flag → ConversationProvider |

## Secondary: other old areas

| Area | Imports | Notes |
|---|---|---|
| `styles/typography` | 26 | design token |
| `src/components` | 20 | 14 of them `results/analysisNew/panelSurfaces` |
| `stores/uiStore` | 4 | old app-wide zustand store; importers: FigureEdit, ViewChances, model/editors, ViewChat |
| `v5/blocks/chipClass` | 4 | — |
| `presentation` | 3 | — |
| `src/poc`, `src/routes` | 0 | — |
