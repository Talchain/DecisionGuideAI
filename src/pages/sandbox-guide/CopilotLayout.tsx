import { ReactFlowProvider } from '@xyflow/react'
import { GuideCanvas } from './components/canvas/GuideCanvas'
import { GuidePanel } from './components/panel/GuidePanel'
import { GuideTopBar } from './components/topbar/GuideTopBar'
import { GuideBottomToolbar } from './components/toolbar/GuideBottomToolbar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useJourneyDetection } from './hooks/useJourneyDetection'
import { HelpModal } from './components/shared/HelpModal'
import { GuideErrorBoundary } from './components/shared/GuideErrorBoundary'
import { DiagnosticBanner } from './DiagnosticBanner'

/**
 * Guide Layout - Main layout component for guide variant
 *
 * Architecture:
 * - Shares backend: PLoT, CEE, Supabase, Auth
 * - Shares canvas: ReactFlowGraph component with guide enhancements
 * - Separate state: useGuideStore for guide-specific UI state
 * - Adaptive panel: Changes content based on journey stage
 * - Visual enhancements: Top drivers legend, node selection (Phase 4)
 * - Top bar & bottom toolbar: Critical alerts, quick actions (Phase 5)
 * - Keyboard shortcuts: ?, Esc, R, C (Phase 5)
 */
export default function GuideLayout() {
  // Auto-detect journey stage based on canvas state, results, and selection
  const journeyStage = useJourneyDetection()

  // Keyboard shortcuts and help modal
  const { showHelp, setShowHelp } = useKeyboardShortcuts()

  return (
    <div className="h-screen flex flex-col bg-mist-50 font-sans">
      {/* Diagnostic Banner - Remove after debugging */}
      <DiagnosticBanner />

      {/* Top Bar */}
      <GuideTopBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas - Flexible width */}
        <div
          className="flex-1 relative bg-white"
          role="main"
          aria-label="Decision model canvas"
        >
          <ReactFlowProvider>
            <GuideCanvas />
          </ReactFlowProvider>
        </div>

        {/* Guide Panel - Fixed 360px width */}
        <div
          className="w-[360px] border-l border-storm-200 bg-white overflow-y-auto"
          role="complementary"
          aria-label="Guide guidance panel"
        >
          <GuideErrorBoundary>
            <GuidePanel stage={journeyStage} />
          </GuideErrorBoundary>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <GuideBottomToolbar />

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
