export { InspectorRouter } from './InspectorRouter'
export { InspectorShell } from './InspectorShell'
export { useTechToggle } from './useTechToggle'
export { useNodeMutations, useEdgeMutations, NODE_LABEL_MAX_LENGTH } from './useInspectorMutations'
export type { InspectorPanelProps, InspectorShellProps, AnalysisState } from './types'

/**
 * L-04 — the rename capability, EXPORTED for the workspace lane.
 *
 * The inspector owns the rename affordance; the canvas owns the gesture. The
 * workspace lane's double-click handler selects the node and then calls
 * `requestNodeRename(nodeId)`; the inspector mounts its title in editing state
 * and consumes the intent. Neither lane reaches into the other's components.
 */
export { requestNodeRename, clearNodeRename, useRenameIntentStore } from './renameIntent'

/**
 * The ONE ask semantic (ledger L-18, trap-21 pair). Any surface offering
 * "ask Olumi about this" routes here: prefill-and-confirm, never auto-send.
 */
export { requestAsk, canReceiveAsk, ASK_SEMANTIC } from './askSemantic'
export type { AskRequest } from './askSemantic'
