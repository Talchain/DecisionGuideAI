import { PanelErrorBoundary } from '../components/PanelErrorBoundary'
import { OutputsDock } from '../components/OutputsDock'
import { DraftChat } from '../components/DraftChat'
import { AIPanelV2Layout } from './AIPanelV2Layout'
import { isAiPanelV2Enabled } from '../../flags'

// Owns the right-edge mount block. Extracted from ReactFlowGraph so tests
// can render the real branching logic instead of mirroring it.
//
// Contract:
//   FF off  →  <OutputsDock /> + <DraftChat />, no AI panel v2.
//   FF on   →  <AIPanelV2Layout /> only. AIPanelV2Layout owns the
//              singleton useConversation() and renders one of five
//              views (welcome / docked / minimised / floating —
//              docked further split into pre-analysis and
//              post-analysis). DraftChat is unmounted so the v2 layout
//              is the only AI instance (singleton invariant).
//              Context-menu "Ask AI" routes through the registered
//              _sendMessage from AIPanelV2Layout's prefill effect.

export function RightPanelMount() {
  const aiPanelOn = isAiPanelV2Enabled()
  return (
    <>
      {!aiPanelOn && (
        <PanelErrorBoundary panel="Results">
          <OutputsDock />
        </PanelErrorBoundary>
      )}
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
