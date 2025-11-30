import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useCopilotStore } from './hooks/useCopilotStore'
import { determineJourneyStage } from './utils/journeyDetection'
import { CopilotCanvas } from './components/canvas/CopilotCanvas'
import { CopilotPanel } from './components/panel/CopilotPanel'
import { CopilotTopBar } from './components/topbar/CopilotTopBar'
import { CopilotBottomToolbar } from './components/toolbar/CopilotBottomToolbar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { HelpModal } from './components/shared/HelpModal'

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
  // Read from shared canvas store (READ ONLY)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  // Read from shared results store (READ ONLY)
  const resultsStatus = useResultsStore((state) => state.status)
  const resultsReport = useResultsStore((state) => state.report)

  // Copilot-specific state
  const journeyStage = useCopilotStore((state) => state.journeyStage)
  const selectedElement = useCopilotStore((state) => state.selectedElement)
  const compareMode = useCopilotStore((state) => state.compareMode)
  const setJourneyStage = useCopilotStore((state) => state.setJourneyStage)

  // Keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts()

  // Detect and update journey stage whenever context changes
  useEffect(() => {
    const stage = determineJourneyStage({
      graph: { nodes, edges },
      results: {
        status: resultsStatus === 'complete' ? 'complete' : 'idle',
        report: resultsReport,
      },
      selectedElement,
      compareMode,
    })
    setJourneyStage(stage)
  }, [nodes, edges, resultsStatus, resultsReport, selectedElement, compareMode, setJourneyStage])

  return (
    <div className="h-screen flex flex-col bg-mist-50">
      {/* Top Bar */}
      <CopilotTopBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas - Flexible width */}
        <div className="flex-1 relative bg-white">
          <ReactFlowProvider>
            <CopilotCanvas />
          </ReactFlowProvider>
        </div>

        {/* Copilot Panel - Fixed 360px width */}
        <div className="w-[360px] border-l border-storm-200 bg-white overflow-y-auto">
          <CopilotPanel stage={journeyStage} />
        </div>
      </div>

      {/* Bottom Toolbar */}
      <CopilotBottomToolbar />

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
