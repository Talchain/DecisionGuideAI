/**
 * Canvas Stores — modular state management barrel.
 *
 * Extracted slices:
 *   useComparisonStore — passive comparison state (C3-3)
 *   useDraftStore — model selection, draft status, generation state (C3-5)
 *   useResultsStore — sandbox-guide results surface (pre-existing)
 *
 * Dormant shadow stores (useDocumentsStore, usePanelsStore) deleted as of
 * C3/C4 follow-up: they had zero production consumers. Documents, panels,
 * and lens state remain in useCanvasStore because their setters are coupled
 * to graph history, panel-coordination side effects, or atomic lens resets.
 */

// Analysis results store (sandbox-guide authoritative source)
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

// Guidance focus store (A.2)
export {
  useGuidanceStore,
  type GuidanceState,
  type GuidanceActions,
  type GuidanceItem,
  type GuidanceAction,
  type GuidanceCategory,
  type GuidanceSource,
  type EvidenceStrength,
  type GuidanceTargetObject,
  type GuidanceTone,
  selectGuidanceItems,
  selectActiveGuidanceItemId,
  selectActiveItem,
  selectItemsForTarget,
  selectTopItem,
  compareGuidanceDisplayOrder,
  guidanceCategoryRank,
  guidanceCategoryTone,
} from './guidanceStore'

// Graph readiness store (consolidated from useGraphReadiness hook)
export {
  useReadinessStore,
  type ReadinessStoreState,
  type ReadinessStoreActions,
  selectReadiness,
  selectReadinessLoading,
  selectReadinessError,
} from './readinessStore'

/**
 * The main store.ts holds graph, history, CEE readiness, results (for the
 * main canvas surface), scenario, and tightly coupled UI state (lens,
 * panels, documents). New results code in the canvas app should use the
 * named selectors in src/canvas/selectors/results.ts.
 */
