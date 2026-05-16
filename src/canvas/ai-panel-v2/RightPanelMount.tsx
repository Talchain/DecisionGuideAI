import { PanelErrorBoundary } from '../components/PanelErrorBoundary'
import { OutputsDock } from '../components/OutputsDock'
import { DraftChat } from '../components/DraftChat'
import { AIPanelV2Layout } from './AIPanelV2Layout'
import { isAiPanelV2Enabled } from '../../flags'

// Owns the right-edge mount block (Results dock + optional AI panel v2 +
// optional legacy DraftChat). Extracted from ReactFlowGraph so tests can
// render the real branching logic instead of mirroring it.
//
// Contract:
//   FF off  →  <OutputsDock /> + <DraftChat />, no AI panel v2.
//   FF on   →  <OutputsDock /> + <AIPanelV2Layout /> (which mounts AIZone
//              and registers _sendMessage via guidanceStore). DraftChat is
//              hidden — context-menu "Ask AI" routes through the registered
//              AIZone sendMessage so its `setShowDraftChat(true)` becomes a
//              no-op (DraftChat is unmounted).
//
// The flip from step 1 (DraftChat coexisting) to this state happens at the
// same commit that wires <AIZone /> into AIPanelV2Layout. The step-2
// singleton checkpoint is satisfied because exactly one `useConversation()`
// instance is active under FF on (the one inside AIZone) — DraftChat is
// not mounted, so its useConversation never runs.

export function RightPanelMount() {
  const aiPanelOn = isAiPanelV2Enabled()
  return (
    <>
      <PanelErrorBoundary panel="Results">
        <OutputsDock />
      </PanelErrorBoundary>
      {aiPanelOn && (
        <PanelErrorBoundary panel="AI conversation">
          <AIPanelV2Layout />
        </PanelErrorBoundary>
      )}
      {!aiPanelOn && (
        <PanelErrorBoundary panel="Draft Chat">
          <DraftChat />
        </PanelErrorBoundary>
      )}
    </>
  )
}
