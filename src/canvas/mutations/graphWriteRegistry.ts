/**
 * Census of canvas graph mutation access, including pending writes and their
 * refusal lifecycle. Registrations describe the named mutators only.
 * known_unresolved records named debt rather than transaction permission: its
 * frozen source-guard list may only shrink as these writers are resolved.
 */
export type GraphWriteClass = 'reply_apply' | 'layout' | 'optimistic' | 'gated_off' | 'known_unresolved'

type GraphWriteRegistryBase = {
  file: string
  mutators: string[]
}
export type GraphWriteRegistryEntry = GraphWriteRegistryBase & (
  | { class: 'reply_apply' | 'layout'; revert?: never; gate?: never }
  | { class: 'optimistic'; revert: string; gate?: never }
  | { class: 'gated_off'; gate: string; revert?: never }
  | { class: 'known_unresolved'; reason: string; owner: 'EDIT-UX mutation transaction'; reopen: string; revert?: never; gate?: never }
)

export const GRAPH_WRITE_REGISTRY: GraphWriteRegistryEntry[] = [
  { file: 'src/v5/applyV5State.ts', mutators: ['updateNode', 'updateEdgeData'], class: 'reply_apply' },
  { file: 'src/canvas/utils/applyDraftResult.ts', mutators: ['batchUpdateNodes', 'setState.nodes', 'setState.edges'], class: 'reply_apply' },
  { file: 'src/canvas/utils/mergeAppliedGraph.ts', mutators: ['setState.nodes', 'setState.edges'], class: 'reply_apply' },
  { file: 'src/canvas/utils/mergeServerGraph.ts', mutators: ['setState.nodes', 'setState.edges'], class: 'reply_apply' },
  { file: 'src/canvas/conversation/utils/applyPatch.ts', mutators: ['setState.nodes', 'setState.edges'], class: 'reply_apply' },
  { file: 'src/hooks/useScenario.ts', mutators: ['hydrateGraphSlice'], class: 'reply_apply' },
  { file: 'src/canvas/components/DraftChat.tsx', mutators: ['setState.nodes', 'setState.edges'], class: 'reply_apply' },
  { file: 'src/canvas/conversation/useConversation.ts', mutators: ['setState.nodes', 'setState.edges'], class: 'reply_apply' },
  { file: 'src/canvas/conversation/optimisticFactorEdit.ts', mutators: ['updateNode'], class: 'reply_apply' },
  { file: 'src/canvas/conversation/optimisticFactorEdit.ts', mutators: ['updateNode'], class: 'optimistic', revert: 'revertOptimisticFactorEdit' },
  { file: 'src/canvas/conversation/optimisticFactorEdit.ts', mutators: ['updateNode'], class: 'optimistic', revert: 'revertOptimisticPriorRangeEdit' },
  { file: 'src/lib/guestCopyOnSignIn.ts', mutators: ['adoptScenario'], class: 'reply_apply' },
  { file: 'src/canvas/example/exampleDecision.ts', mutators: ['adoptScenario'], class: 'reply_apply' },
  { file: 'src/lib/auth/userScopedState.ts', mutators: ['resetCanvas'], class: 'reply_apply' },
  // ReactFlowGraph has cold-load hydration, layout and structural gestures.
  // onNodesChange/onEdgesChange forward both classes without changing handlers:
  // non-remove changes are layout; remove changes capture structural_delete in
  // store.ts:4105/4267 and use revertStructuralDelete on refusal.
  { file: 'src/canvas/ReactFlowGraph.tsx', mutators: ['hydrateGraphSlice', 'loadScenario'], class: 'reply_apply' },
  { file: 'src/canvas/ReactFlowGraph.tsx', mutators: ['onNodesChange', 'onEdgesChange', 'applyLayout'], class: 'layout' },
  { file: 'src/canvas/ReactFlowGraph.tsx', mutators: ['onNodesChange', 'onEdgesChange'], class: 'optimistic', revert: 'revertStructuralDelete' },
  { file: 'src/canvas/useKeyboardShortcuts.ts', mutators: ['nudgeSelected'], class: 'layout' },
  { file: 'src/canvas/hooks/useMeasureThenLayout.ts', mutators: ['applyLayout'], class: 'layout' },
  { file: 'src/canvas/hooks/useRestoredLayoutWidth.ts', mutators: ['setState.nodes'], class: 'layout' },
  { file: 'src/canvas/contextMenu/useMenuItems.ts', mutators: ['applyLayout'], class: 'layout' },
  { file: 'src/canvas/contextMenu/actions.ts', mutators: ['setState.nodes'], class: 'layout' },
  { file: 'src/canvas/contextMenu/actions.ts', mutators: ['addNode', 'addNodeWithEdge'], class: 'optimistic', revert: 'revertStructuralAdd' },
  { file: 'src/canvas/contextMenu/actions.ts', mutators: ['deleteNodeById', 'deleteEdge', 'deleteSelected'], class: 'optimistic', revert: 'revertStructuralDelete' },
  { file: 'src/canvas/components/pre-analysis-v3/hero/HeroSection.tsx', mutators: ['addNode'], class: 'optimistic', revert: 'revertStructuralAdd' },
  { file: 'src/canvas/components/pre-analysis-v3/hero/HeroSection.tsx', mutators: ['updateNodeLabel'], class: 'optimistic', revert: 'revertStructuralRename' },
  { file: 'src/canvas/components/pre-analysis-v3/model/YourDecisionSection.tsx', mutators: ['addNode'], class: 'optimistic', revert: 'revertStructuralAdd' },
  { file: 'src/canvas/ui/inspector-v2/panels/DecisionPanel.tsx', mutators: ['addNodeWithEdge'], class: 'optimistic', revert: 'revertStructuralAdd' },
  { file: 'src/canvas/components/ModelTabBody.tsx', mutators: ['updateNodeLabel'], class: 'optimistic', revert: 'revertStructuralRename' },
  { file: 'src/canvas/nodes/BaseNode.tsx', mutators: ['updateNodeLabel'], class: 'optimistic', revert: 'revertStructuralRename' },
  { file: 'src/canvas/nodes/OptionNode.tsx', mutators: ['updateNodeLabel'], class: 'optimistic', revert: 'revertStructuralRename' },
  { file: 'src/canvas/ui/inspector-v2/InspectorRouter.tsx', mutators: ['updateNodeLabel'], class: 'optimistic', revert: 'revertStructuralRename' },
  // updateNode in this hook mixes reversible factor/prior edits with live
  // local-only setObservedField/guest-confirmation and value fallback paths.
  // A file/mutator key cannot distinguish them: record the mixed key as named
  // unresolved debt below rather than claiming a reversible or gated path.
  // Slider preview ticks now capture/revert through pendingEdgeEdit. Ordinary
  // strength/direction fallback writes still leave this mixed key as named debt.
  { file: 'src/canvas/ui/inspector-v2/useInspectorMutations.ts', mutators: ['updateEdge'], class: 'optimistic', revert: 'revertEdgeEdit' },
  { file: 'src/canvas/components/pre-analysis-v3/model/CalibrateDrillIn.tsx', mutators: ['updateNode'], class: 'optimistic', revert: 'revertOptimisticFactorEdit' },
  // EdgePanel updateEdgeData is a structural_add_edge retry, not a strength
  // edit. Its no-revert gap is named unresolved debt; preserve the retry writer.
  // This applies only after handleSettle accepts the adjudication; it refuses
  // before retiring the prior edge (ContestedSection handleSettle).
  { file: 'src/canvas/components/pre-analysis-v3/contested/ContestedSection.tsx', mutators: ['updateEdge'], class: 'reply_apply' },
  { file: 'src/canvas/conversation/pendingEdgeEdit.ts', mutators: ['updateEdge'], class: 'optimistic', revert: 'revertEdgeEdit' },
  { file: 'src/canvas/conversation/useConversation.ts', mutators: ['applyStructuralAddRevert'], class: 'optimistic', revert: 'revertStructuralAdd' },
  { file: 'src/canvas/conversation/useConversation.ts', mutators: ['applyStructuralRenameRevert'], class: 'optimistic', revert: 'revertStructuralRename' },
  { file: 'src/canvas/conversation/useConversation.ts', mutators: ['applyStructuralDeleteRevert'], class: 'optimistic', revert: 'revertStructuralDelete' },
  { file: 'src/canvas/mutations/structuralAdd.ts', mutators: ['applyStructuralAddRevert'], class: 'optimistic', revert: 'revertStructuralAdd' },
  { file: 'src/canvas/mutations/structuralRename.ts', mutators: ['applyStructuralRenameRevert'], class: 'optimistic', revert: 'revertStructuralRename' },
  { file: 'src/canvas/mutations/structuralDelete.ts', mutators: ['applyStructuralDeleteRevert'], class: 'optimistic', revert: 'revertStructuralDelete' },
  { file: 'src/canvas/contextMenu/actions.ts', mutators: ['duplicateSelected', 'updateEdgeEndpoints', 'updateNode', 'updateEdgeData', 'setState.nodes', 'setState.edges'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations' },
  { file: 'src/canvas/useKeyboardShortcuts.ts', mutators: ['duplicateSelected', 'cutSelected', 'pasteClipboard'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations' },
  { file: 'src/canvas/components/OutputsDock.tsx', mutators: ['applyAutoFixChanges'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.postRunAutoFix' },
  { file: 'src/canvas/components/OutputsDock.tsx', mutators: ['setGoalThresholdAndUpdateNode'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.goalSuccessTarget' },
  { file: 'src/components/results/modals/DefineSuccessModal.tsx', mutators: ['setGoalThresholdAndUpdateNode'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.goalSuccessTarget' },
  { file: 'src/canvas/components/pre-analysis/PreAnalysisPanel.tsx', mutators: ['updateNode'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.preAnalysisFactorValue' },
  { file: 'src/canvas/components/pre-analysis/PreAnalysisPanel.tsx', mutators: ['updateNode'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.preAnalysisFactorConfirmation' },
  { file: 'src/canvas/components/pre-analysis/PreAnalysisPanel.tsx', mutators: ['updateEdgeData'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.preAnalysisEdgeStrength' },
  { file: 'src/canvas/components/pre-analysis/PreAnalysisPanel.tsx', mutators: ['setGoalThresholdAndUpdateNode'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.goalSuccessTarget' },
  { file: 'src/canvas/components/pre-analysis-v3/hero/HeroSection.tsx', mutators: ['setGoalThresholdAndUpdateNode'], class: 'gated_off', gate: 'CANONICAL_EDIT_AUTHORITY.goalSuccessTarget' },
  // Importer evidence: no non-test imports of these modules. GuidedLayoutDialog
  // is imported only by the unused LayoutPopover; useCEECoaching only by the
  // unused GuidancePanel. Retain files until a separately scoped deletion.
  { file: 'src/canvas/hooks/useModelActionApply.ts', mutators: ['addNode', 'updateNode', 'addEdge', 'updateEdge', 'deleteNodeById', 'deleteEdgeById'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/hooks/useAddBaseline.ts', mutators: ['addNode', 'updateNode', 'addEdge'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/components/ActionsSignal.tsx', mutators: ['applyAutoFixChanges'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/panels/InspectorPanel.tsx', mutators: ['updateEdge'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/components/GoalNodeSelector.tsx', mutators: ['updateNodeData'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/components/LayoutPopover.tsx', mutators: ['applySimpleLayout'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/components/GuidedLayoutDialog.tsx', mutators: ['applyGuidedLayout'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/components/LayoutGuidedModal.tsx', mutators: ['applyGuidedLayout'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/hooks/useCEECoaching.ts', mutators: ['addNode'], class: 'gated_off', gate: 'no_live_importer' },
  // InspectorModal USE_INSPECTOR_V2=true returns before either v1 inspector.
  { file: 'src/canvas/ui/NodeInspector.tsx', mutators: ['updateNode'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/ui/EdgeInspector.tsx', mutators: ['updateEdge', 'deleteEdge'], class: 'gated_off', gate: 'no_live_importer' },
  // The only beginReconnect callers are inside the bypassed v1 EdgeInspector.
  // The reset sheet's local state has no true setter/opening path.
  { file: 'src/canvas/ReactFlowGraph.tsx', mutators: ['completeReconnect', 'resetCanvas'], class: 'gated_off', gate: 'no_live_importer' },
  // showAIClarifier defaults false and every setter only closes it. The
  // component palette's local state likewise has no opener (the live palette
  // is src/canvas/palette/CommandPalette.tsx, a different module).
  { file: 'src/canvas/panels/AIClarifierChat.tsx', mutators: ['applyClarifierGraph'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/components/CommandPalette.tsx', mutators: ['addNode'], class: 'gated_off', gate: 'no_live_importer' },
  // ReactFlowGraph records the removed recovery-banner mount; no non-test
  // module imports or renders RecoveryBanner.
  { file: 'src/canvas/components/RecoveryBanner.tsx', mutators: ['setState.nodes', 'setState.edges'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/canvas/layout/runLayoutWithProgress.ts', mutators: ['applyLayout'], class: 'layout' },
  // Used only after applyDraftResult; these are canvas provenance annotations.
  { file: 'src/canvas/starters/loadStarter.ts', mutators: ['setState.nodes'], class: 'reply_apply' },
  // pasteAction has no menu invocation: useMenuItems omits the paste entry.
  { file: 'src/canvas/contextMenu/actions.ts', mutators: ['pasteClipboard'], class: 'gated_off', gate: 'no_live_importer' },
  // The sandbox GuideLayout/CopilotLayout roots have no non-test importer.
  { file: 'src/pages/sandbox-guide/components/canvas/GhostSuggestionsOverlay.tsx', mutators: ['addEdge'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/pages/sandbox-guide/components/panel/sections/BiasMitigation.tsx', mutators: ['addNode', 'addEdge'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/pages/sandbox-guide/components/panel/states/EmptyState.tsx', mutators: ['addNode', 'applyLayout'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/pages/sandbox-guide/hooks/useGhostSuggestions.ts', mutators: ['addEdge'], class: 'gated_off', gate: 'no_live_importer' },
  { file: 'src/pages/sandbox-guide/hooks/usePostRunHighlighting.ts', mutators: ['setNodes', 'setEdges'], class: 'gated_off', gate: 'no_live_importer' },
  // Addendum 1 ratchet: the fourteen STOP rows describe nineteen file/mutator
  // keys. The structural-add-edge row names two files, so it requires two
  // entries with the same verbatim reason. Resolution removes the named key
  // from both this registry and the source guard's frozen list.
  { file: 'src/components/layout/KebabMenu.tsx', mutators: ['resetCanvas'], class: 'known_unresolved', reason: 'Live confirmed Start new model action; no server carrier or disabled gate', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/components/StarterProvenanceBanner.tsx', mutators: ['resetCanvas', 'undoDraft'], class: 'known_unresolved', reason: 'Live redraft/recovery path mounted by ReactFlowGraph; local replacement/restoration', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/conversation/useConversation.ts', mutators: ['undoDraft', 'resetCanvas'], class: 'known_unresolved', reason: 'Live undo chip and start-new-draft paths; no durable transaction', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/components/ImportExportDialog.tsx', mutators: ['importCanvas'], class: 'known_unresolved', reason: 'Live KebabMenu import dialog; local graph replacement', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/components/SnapshotManager.tsx', mutators: ['importCanvas'], class: 'known_unresolved', reason: 'Live snapshot restore; local graph replacement', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/components/ScenarioSwitcher.tsx', mutators: ['loadScenario'], class: 'known_unresolved', reason: 'Live guest/local loading and all-mode import route, not a disabled authority', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/components/DraftChat.tsx', mutators: ['resetCanvas'], class: 'known_unresolved', reason: 'Conditional-live legacy chat, deliberately reachable by feature.aiPanelV2 localStorage override; reset precedes the send', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/ReactFlowGraph.tsx', mutators: ['applyRepair'], class: 'known_unresolved', reason: 'IssuesPanel can reopen from persisted showIssuesPanel preference; no honest dead-importer proof', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-lifecycle' },
  { file: 'src/canvas/mutations/commitGraphMutation.ts', mutators: ['setState.nodes', 'setState.edges'], class: 'known_unresolved', reason: 'Debug PayloadLab route is live in staging/development; gated template callers do not gate the shared helper', owner: 'EDIT-UX mutation transaction', reopen: 'debug-route' },
  { file: 'src/canvas/mutations/commitValidatedMutation.ts', mutators: ['setState.nodes', 'setState.edges'], class: 'known_unresolved', reason: 'Module is live for durable structural actions. Alternate raw branch needs an absent validatePatch capability, not a disabled authority; required registry schema cannot express that conditional proof', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-validate-capability' },
  { file: 'src/canvas/ReactFlowGraph.tsx', mutators: ['addEdge'], class: 'known_unresolved', reason: 'structural_add_edge has no equivalent created-edge revert lifecycle; useStructuralAddEdgeEvents.ts:18-29 states this explicitly', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-structural-add-edge-rollback' },
  { file: 'src/canvas/hooks/useConnectGesture.ts', mutators: ['addEdge'], class: 'known_unresolved', reason: 'structural_add_edge has no equivalent created-edge revert lifecycle; useStructuralAddEdgeEvents.ts:18-29 states this explicitly', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-structural-add-edge-rollback' },
  { file: 'src/canvas/ui/inspector-v2/panels/EdgePanel.tsx', mutators: ['updateEdgeData'], class: 'known_unresolved', reason: 'Structural-add-edge retry capture, without created-edge rollback. Preserved unchanged as expressly required', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-structural-add-edge-rollback' },
  { file: 'src/canvas/ui/inspector-v2/useInspectorMutations.ts', mutators: ['updateNode'], class: 'known_unresolved', reason: 'Local-only factor value fallback and guest confirmation provenance. Live callers include useModelEditAuthority:668-670/718/911 and ModelReviewTool:342/734-745', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-local-fallback' },
  { file: 'src/canvas/ui/inspector-v2/useInspectorMutations.ts', mutators: ['updateEdge'], class: 'known_unresolved', reason: 'Ordinary strength/preset and direction setters still write before absent-carrier/not-encodable outcomes; slider preview commits now restore their original capture', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-local-fallback' },
]
