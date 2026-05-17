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
//   FF on   →  <AIPanelV2Layout /> only. AIPanelV2Layout internally mounts
//              <OutputsDock embedded /> + <AIZone /> as a single split
//              column. DraftChat is unmounted so AIZone's useConversation
//              is the only AI instance (singleton invariant per
//              correction #9). Context-menu "Ask AI" routes through the
//              registered _sendMessage from AIZone's ConversationPanel.

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
