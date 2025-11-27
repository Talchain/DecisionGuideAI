/**
 * Canvas Stores - Modular state management
 *
 * This module exports individual stores that were extracted from
 * the monolithic src/canvas/store.ts for better modularity.
 *
 * Migration Status:
 * - panelsStore: ✅ Extracted (panel visibility flags)
 * - resultsStore: ✅ Extracted (analysis results state)
 * - documentsStore: ✅ Extracted (documents and citations)
 * - graphHealthStore: ✅ Extracted (validation and repair)
 * - graphStore: 🔄 Pending (nodes, edges, history - largest slice)
 * - scenarioStore: 🔄 Pending (scenario management)
 *
 * See docs/STORE_MODULARIZATION_PLAN.md for full migration plan.
 */

// Panel visibility store
export {
  usePanelsStore,
  type PanelsState,
  type PanelsActions,
  selectShowResultsPanel,
  selectShowInspectorPanel,
  selectShowTemplatesPanel,
  selectShowIssuesPanel,
} from './panelsStore'

// Analysis results store
export {
  useResultsStore,
  type ResultsState,
  type ResultsStatus,
  type RunMetaState,
  type SseDiagnostics,
  type ResultsStoreState,
  type ResultsActions,
  selectResultsStatus,
  selectResultsProgress,
  selectResultsReport,
  selectResultsError,
  selectResultsHash,
  selectHasCompletedFirstRun,
} from './resultsStore'

// Documents and citations store
export {
  useDocumentsStore,
  type DocumentsState,
  type DocumentsActions,
  selectDocuments,
  selectCitations,
  selectDocumentSearchQuery,
  selectDocumentSort,
} from './documentsStore'

// Graph health and validation store
export {
  useGraphHealthStore,
  type GraphHealthState,
  type GraphHealthActions,
  selectGraphHealth,
  selectNeedleMovers,
  selectHighlightedNodes,
  selectHasIssues,
} from './graphHealthStore'

/**
 * IMPORTANT: For backward compatibility, the main store.ts still exists
 * and provides the combined useCanvasStore hook. New code should prefer
 * using the individual stores above for better performance (fewer re-renders)
 * and easier testing.
 *
 * Migration guide:
 *
 * // Before (triggers re-render on any store change)
 * const showResultsPanel = useCanvasStore(s => s.showResultsPanel)
 *
 * // After (only re-renders when panel state changes)
 * const showResultsPanel = usePanelsStore(s => s.showResultsPanel)
 */
