import { PanelErrorBoundary } from '../components/PanelErrorBoundary'
import { OutputsDock } from '../components/OutputsDock'
import { DraftChat } from '../components/DraftChat'
import { AIPanelV2Layout } from './AIPanelV2Layout'
import { isAiPanelV2Enabled } from '../../flags'

// Owns the right-edge mount block (Results dock + optional AI panel v2 +
// legacy DraftChat). Extracted from ReactFlowGraph so tests can render the
// real branching logic instead of mirroring it.
//
// Step 1 contract:
//   FF off  →  <OutputsDock /> + <DraftChat />, no AI panel v2.
//   FF on   →  <OutputsDock /> + <AIPanelV2Layout /> + <DraftChat />.
//
// DraftChat stays mounted under FF on **as a temporary scaffold** so that
// context-menu "Ask AI" (which calls setShowDraftChat) and the toolbar AI
// button keep working until the in-panel input bar lands. The brief's
// step-2 `useConversation` singleton checkpoint must pass before DraftChat
// is hidden — see `docs/ai-panel-v2/STEP1_CLOSEOUT.md`.

export function RightPanelMount() {
  return (
    <>
      <PanelErrorBoundary panel="Results">
        <OutputsDock />
      </PanelErrorBoundary>
      {isAiPanelV2Enabled() && (
        <PanelErrorBoundary panel="AI conversation">
          <AIPanelV2Layout />
        </PanelErrorBoundary>
      )}
      <PanelErrorBoundary panel="Draft Chat">
        <DraftChat />
      </PanelErrorBoundary>
    </>
  )
}
