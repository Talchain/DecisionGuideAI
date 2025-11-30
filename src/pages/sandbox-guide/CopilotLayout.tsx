import { ReactFlowProvider } from '@xyflow/react'
import { CopilotCanvas } from './components/canvas/CopilotCanvas'
import { CopilotPanel } from './components/panel/CopilotPanel'
import { CopilotTopBar } from './components/topbar/CopilotTopBar'
import { CopilotBottomToolbar } from './components/toolbar/CopilotBottomToolbar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useJourneyDetection } from './hooks/useJourneyDetection'
import { HelpModal } from './components/shared/HelpModal'
import { CopilotErrorBoundary } from './components/shared/CopilotErrorBoundary'

/**
 * Copilot Layout - Main layout component for copilot variant
 *
 * Architecture:
 * - Shares backend: PLoT, CEE, Supabase, Auth
 * - Shares canvas: ReactFlowGraph component with copilot enhancements
 * - Separate state: useCopilotStore for copilot-specific UI state
 * - Adaptive panel: Changes content based on journey stage
 * - Visual enhancements: Top drivers legend, node selection (Phase 4)
 * - Top bar & bottom toolbar: Critical alerts, quick actions (Phase 5)
 * - Keyboard shortcuts: ?, Esc, R, C (Phase 5)
 */
export default function CopilotLayout() {
  // Auto-detect journey stage based on canvas state, results, and selection
  const journeyStage = useJourneyDetection()

  // Keyboard shortcuts and help modal
  const { showHelp, setShowHelp } = useKeyboardShortcuts()

  return (
    <div className="h-screen flex flex-col bg-mist-50">
      {/* Top Bar */}
      <CopilotTopBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas - Flexible width */}
        <div
          className="flex-1 relative bg-white"
          role="main"
          aria-label="Decision model canvas"
        >
          <ReactFlowProvider>
            <CopilotCanvas />
          </ReactFlowProvider>
        </div>

        {/* Copilot Panel - Fixed 360px width */}
        <div
          className="w-[360px] border-l border-storm-200 bg-white overflow-y-auto"
          role="complementary"
          aria-label="Copilot guidance panel"
        >
          <CopilotErrorBoundary>
            <CopilotPanel stage={journeyStage} />
          </CopilotErrorBoundary>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <CopilotBottomToolbar />

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
