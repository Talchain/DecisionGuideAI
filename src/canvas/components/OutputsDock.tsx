/**
 * OutputsDock - Canonical right-side outputs dock (CURRENT UX)
 *
 * ✅ ARCHITECTURE NOTE:
 * This is the **canonical Results UX** for the canvas. It provides a streamlined,
 * dock-based interface with three tabs:
 *
 * Tabs:
 * - Results: Pre-run validation + Run button, post-run KPI headline, range display,
 *            insights panel, decision review, top drivers
 * - Compare: Side-by-side run comparison with delta interpretation
 * - Structure: Graph text view with node breakdown, evidence stats, streaming diagnostics
 *
 * This component supersedes the legacy ResultsPanel (src/canvas/panels/ResultsPanel.tsx),
 * which is NOT currently rendered in the main canvas flow.
 *
 * Features:
 * - Auto-opens on run completion/error
 * - Resizable width
 * - Persistent state in localStorage
 * - Syncs with `showResultsPanel` store flag for UI coordination
 * - Auto-fix for validation issues with telemetry tracking
 * - Slow-run feedback messages (20s/40s thresholds)
 */

import { useEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from 'react'
import { BarChart3, Shuffle, Activity, Clock, AlertTriangle, HelpCircle, XCircle, MessageCircle, MessageSquare, CheckCircle, FlaskConical } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore, type OutputTab } from '../../stores/uiStore'
import { useDockState } from '../hooks/useDockState'
import { AnalysisRunningBanner } from './AnalysisRunningBanner'
import { AnalysisRunAnnouncer } from './AnalysisRunAnnouncer'
import { runStatusRegion } from './analysisRunStatus'
import { registerCanonicalRunner, type CanonicalRunOptions, type CanonicalRunOutcome } from '../analysis/canonicalRunRegistry'
import { useShowToastSafe } from '../ToastContext'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useCanvasStore, selectResultsStatus, selectReport, selectError, selectResultsSource, selectResultsStartedAt } from '../store'
import { resolveDisplayedFreshness } from '../store/analysisFreshness'
import { getScenario } from '../store/scenarios'
import { AnalysisFreshnessNotice } from '../../components/results/AnalysisFreshnessNotice'
import { DecisionOverviewCard } from '../../components/results/decision-overview/DecisionOverviewCard'
import { isDecisionOverviewEnabled } from '../../flags'
import { deriveResultsTabFreshness } from './resultsTabFreshness'
import { typography, typo } from '../../styles/typography'
import {
  trackCompareOpened,
  trackAutoFixClicked,
  trackAutoFixSuccess,
  trackAutoFixFailed,
} from '../utils/sandboxTelemetry'
import { isJourneyTabEnabled, isCompareTabEnabled, isAiPanelV2Enabled, isPreAnalysisV3Enabled } from '../../flags'
import { OlumiTabBody } from './OlumiTabBody'
import { PersistentInputStrip } from './PersistentInputStrip'
import { SelectionPill } from './SelectionPill'
import { CogPopover } from './CogPopover'
import { useConversationContext, useOptionalConversationContext } from '../conversation/ConversationContext'
import { useFloatingPanelState } from '../hooks/useFloatingPanelState'
import { dockHostsOlumi } from './olumiSurface'
import {
  shouldAutoExpandDockForResponse,
  latestRealMessageIsAssistantReply,
  latestRealMessageIsFailedTurn,
} from './collapsedResponseSignal'
import {
  countAnalysisReviewBlocks,
  shouldReturnToOlumiAfterRun,
} from './runReturnSignal'
import { scrollAnalysisResultIntoView } from './scrollAnalysisResultIntoView'
import { useTransitionReceipt } from '../hooks/useTransitionReceipt'
import { focusFloating } from '../hooks/useFloatingFocus'
import { isV5CanonicalRunPath } from '../../v5/eligibility'
import { countFactorsToVerify, deriveFactorInfluenceMap } from './model-tab/utils'
import { getGoalDirection } from '../utils/getObjectiveText'
import { deriveVerdict } from '../utils/interpretOutcome'
import { useDebugShortcut } from '../hooks/useDebugShortcut'
import { IdentifiabilityBadge, normalizeIdentifiabilityTag } from './IdentifiabilityBadge'
import { ValidationPanel, type CritiqueItem } from './ValidationPanel'
import { PreAnalysisPanel } from './pre-analysis'
import {
  computeInfluenceCoverage,
  isTransitionBridgeReviewed,
} from './pre-analysis-v3/selectors/computeInfluenceCoverage'
// Lazy: flag-off users never pay the v3 bundle cost.
const PreAnalysisPanelV3 = lazy(() => import('./pre-analysis-v3'))
import { useConversation } from '../conversation/useConversation'
import {
  canRunAnalysis as canRunAnalysisUtil,
  getRunButtonTooltip,
  computeCeeCannotSeeModel,
  readinessObjectsToRun,
  verdictLicenceSuperseded,
  RUN_LICENCE_SUPERSEDED_REFUSAL,
  type ReadinessVerdictLicence,
} from '../utils/canRunAnalysis'
import { selectOptionsNeedingValues } from '../utils/composeBlockedReason'
import { WarningBanner } from './WarningBanner'
import { DegradedStateBanner } from './DegradedStateBanner'
import { mapConfidenceToReadiness } from '../utils/mapConfidenceToReadiness'
// ROADMAP 2.109: the goal-threshold normalisation helpers and the
// success-measure/scenario-key lookups left with the retired chip parameter —
// only the goal-node resolver is still used (the atomic target commit).
import { useV2Run, resolveActiveGoalNodeId, type V2RunPersistence } from '../hooks/useV2Run'
import { useScenario } from '../../hooks/useScenario'
import { focusExistingTarget } from '../utils/focusHelpers'
import { normaliseRawFactorValue, withObservedStateUpdate } from '../utils/observedStateHelpers'
import { ModelTabBody } from './ModelTabBody'
import { JourneyTabBody } from '../journey/JourneyTabBody'
import { CompareTabBody as CompareTabBodyV2 } from '../compare-tab/CompareTabBody'
// Results Panel Redesign: v7 four-section layout components
import { useResultsSectionData } from '../../components/results/useResultsSectionData'
import type { TornadoRow } from '../../components/results/TornadoChart'
import { useCanvasResultsSync } from '../../components/results/useCanvasResultsSync'
import { ResultsBody } from '../../components/results/ResultsBody'
import { V7ComparisonTabBody } from '../../components/results/v7/V7ComparisonTabBody'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useDraftStore, draftStreamPhaseFor } from '../stores/draftStore'
import { executeAutoFix, determineFixType, type AutoFixParams } from '../utils/autoFix'
import { getStrengthCorrections } from '../../adapters/plot/v2/adapter'
// P0.6: User-friendly error messages
import { getUserFriendlyError } from '../../lib/userFriendlyErrors'
import { areDriversInformative } from '../../lib/driversGating'
import { useDegeneracyDismissal } from './DegeneracyWarning'
// P0.7: Loading skeletons
import { ResultsPanelSkeleton } from './ResultsPanelSkeleton'
// P0.8: Instrumentation
import { trackRunStarted, trackRunCompleted, trackRunFailed } from '../../lib/resultsInstrumentation'
import { isErrorReport } from '../../adapters/plot/v2/responseMapper'
import { useScenarioComparison } from '../hooks/useScenarioComparison'
import { useRobustness } from '../hooks/useRobustness'
import { mapRobustness } from '../../lib/mappers/mapRobustness'
import type { MappedRobustness } from '../../lib/mappers/types'
// ScenarioComparison modal removed - now rendered as ComparisonCanvasLayout in ReactFlowGraph
import type { CritiqueItemV1 } from '../../adapters/plot/types'
import { verboseDebug } from '../../utils/verboseLog'
import { AnalysisFooter } from '../shared/AnalysisFooter'
import { derivePostFooterStatus, derivePostFooterMeta } from './utils/postAnalysisFooter'
import { useGraphReadiness } from '../hooks/useGraphReadiness'
// ROADMAP 2.635 (I-4) — read at DISPATCH time, not via a render-scope selector:
// the whole point of the licence barrier is to see the store as it is when the
// run actually goes out, not as it was when the gate was computed.
import { useReadinessStore } from '../stores/readinessStore'
import { AskOlumiDrawer } from '../../components/results/coaching/AskOlumiDrawer'
import { DefineSuccessModal, DecisionRecordModal, HowComputedModal } from '../../components/results/modals'

/**
 * Map API critique format (CritiqueItemV1) to ValidationPanel format
 * Converts severity to level and passes through node/edge references for click-to-focus
 * Only marks items as auto_fixable if we actually support that fix type
 */
function mapCritiqueToValidation(critique: CritiqueItemV1[] | undefined): CritiqueItem[] {
  if (!critique || critique.length === 0) return []

  return critique.map(c => ({
    level: c.severity === 'BLOCKER' ? 'blocker' : c.severity === 'WARNING' ? 'warning' : 'info',
    message: c.message,
    code: c.code,
    node_id: c.node_id,
    edge_id: c.edge_id,
    suggested_fix: c.suggested_fix,
    // Only show auto-fix button if we actually support this fix type
    auto_fixable: c.auto_fixable && c.code ? !!determineFixType(c.code) : false,
  }))
}

/** Derived from the store's union rather than hand-mirrored beside it —
 *  the two were previously separate "must match exactly" copies (trap 12). */
type OutputsDockTab = OutputTab

interface OutputsDockState {
  isOpen: boolean
  activeTab: OutputsDockTab
}

export const OUTPUTS_DOCK_STORAGE_KEY = 'canvas.outputsDock.v1'
const STORAGE_KEY = OUTPUTS_DOCK_STORAGE_KEY

/**
 * Render-time read of the persisted dock-tab from sessionStorage. Used by
 * FloatingOlumiPanel to align its render-time duplicate-surface yield gate
 * with the SAME effective tab that OutputsDock paints on first render —
 * before the E1 sync effect copies the persisted state into useUIStore.
 *
 * Without this, OutputsDock can restore `state.activeTab='olumi'` from
 * sessionStorage while `useUIStore.activeOutputTab` is still the default
 * 'results', and both surfaces would paint for one frame before the post-
 * paint effect reconciles them.
 *
 * Returns `null` when sessionStorage is unavailable or the persisted
 * payload is missing/invalid (consumer falls back to useUIStore).
 */
export function readPersistedActiveDockTab(): OutputsDockTab | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(OUTPUTS_DOCK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OutputsDockState>
    const tab = parsed?.activeTab
    if (tab === 'results' || tab === 'altview' || tab === 'compare' || tab === 'diagnostics' || tab === 'journey' || tab === 'olumi') {
      return tab
    }
    return null
  } catch {
    return null
  }
}

/**
 * Render-time read of the persisted dock OPEN-state from sessionStorage.
 * Mirrors readPersistedActiveDockTab so FloatingOlumiPanel can decide whether
 * the dock is actually hosting Olumi (dockHostsOlumi) without a render-time
 * dependency on OutputsDock's component state. Returns null when sessionStorage
 * is unavailable or the persisted payload is missing/invalid.
 */
export function readPersistedDockOpen(): boolean | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(OUTPUTS_DOCK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OutputsDockState>
    return typeof parsed?.isOpen === 'boolean' ? parsed.isOpen : null
  } catch {
    return null
  }
}

/**
 * Pure helper for the toggle-open click handler.
 *
 * Returns the next persisted `state.isOpen` value based on the user's CURRENT
 * VISUAL STATE (effectiveIsOpen) rather than the stored preference. This
 * matters during the aiPanelV2 first-use rail: state.isOpen is true (default)
 * but visually the dock is collapsed because `isFirstUse` overrides
 * effectiveIsOpen. Without this helper, clicking the rail's chevron would
 * set state.isOpen=false → effectiveIsOpen stays false → no visible change.
 *
 * Tested in isolation via aiPanelV2.interactions.spec.tsx.
 */
export function deriveNextDockIsOpen(isFirstUse: boolean, storedIsOpen: boolean): boolean {
  const wasVisuallyOpen = isFirstUse ? false : storedIsOpen
  return !wasVisuallyOpen
}

// Round-2 had `selectEffectiveActiveTab` — a render-time redirect from
// 'olumi' to a fallback when the floating panel was open. Round-3 made
// the click handler close the floating panel on Olumi-tab click, and
// round-5 added a guard effect for non-click paths, so the helper became
// dead identity. Removed in round-5 to avoid future reviewers assuming it
// still enforces the duplicate-surface invariant — the invariant is now
// enforced by `handleTabClick` + the close-floating-on-olumi-active
// effect (see OutputsDockBody below).

/** Dynamic accessor: re-evaluates feature flags on every call. Exported so
 *  parity tests can verify tab gating without remounting OutputsDock. The
 *  component computes its own OUTPUT_TABS via useMemo at render time, so a
 *  localStorage flag flip plus a re-render is enough — no module reload
 *  required for the gating to reflect the new flag state. */
export function getOutputTabsForParity(): { id: OutputsDockTab; label: string }[] {
  return [
    // Olumi leads the strip as the first (leftmost) tab by product decision —
    // keep it first. The default-SELECTED tab is independent: it stays
    // 'results' (Analysis) via the state initialiser, not array position.
    ...(isAiPanelV2Enabled() ? [{ id: 'olumi' as const, label: 'Olumi' }] : []),
    { id: 'results', label: 'Analysis' },
    // TEMPORARY comparison tab (Paul, 12 Aug 2026): hosts the V7 assessment
    // group MOVED off the Analysis tab (see v7/V7ComparisonTabBody.tsx), so
    // the two renderings of the same analysis stay comparable side by side.
    // Unflagged on purpose (no-dark-launch); retires with the V7-vs-Current
    // adjudication (COMPONENT-INVENTORY 2026-08-12 §10A). Sits directly after
    // 'results' so the two surfaces under comparison are adjacent.
    { id: 'altview', label: 'Alt view' },
    ...(isCompareTabEnabled() ? [{ id: 'compare' as const, label: 'Compare' }] : []),
    // ⚠ IDENTITY TRAP — READ THIS BEFORE WRITING A TEST AGAINST "THE MODEL TAB".
    // The tab a user (and every brief, roadmap row and bug report) calls "Model"
    // has id `'diagnostics'`, not `'model'`. There is no tab whose id is 'model'.
    // A spec that queries `'model'` — by id, by testid, or by `getByRole('tab',
    // { name: ... })` against the wrong string — binds to NOTHING and passes
    // vacuously, and this is the most-touched surface in the product. The live
    // testid is `outputs-dock-tab-diagnostics` (see the tab strip below); bind to
    // that, or to the exact label 'Model' — never to a guessed id. Recorded here
    // rather than in a doc because the next lane reads the code (ROADMAP 2.474;
    // trap 19 — bind by identity, never by a value another object could satisfy).
    { id: 'diagnostics', label: 'Model' },
    ...(isJourneyTabEnabled() ? [{ id: 'journey' as const, label: 'Journey' }] : []),
  ]
}

/**
 * Public OutputsDock entry point.
 *
 * **Critical singleton invariant:** exactly one `useConversation()` instance
 * must be mounted at runtime. Two instances cause the scenario-hydration
 * race at `useConversation.ts:797` plus duplicated telemetry, and split
 * message state between the dock's Analysis/Model CTAs and the Olumi
 * floating surfaces (each surface would send via a different conversation).
 *
 * Under aiPanelV2 ON: the canvas-root `<ConversationProvider>` in
 * `ReactFlowGraph` owns the singleton; this host MUST consume that context
 * (never call `useConversation()` directly).
 *
 * Under aiPanelV2 OFF: there is no provider, so this host owns the
 * conversation directly via `useConversation()` (legacy behaviour).
 *
 * The flag check happens HERE so each branch is a distinct component
 * (Rules-of-Hooks compliant: each branch calls hooks unconditionally; only
 * the entry-point branches on the flag).
 */
export function OutputsDock() {
  if (isAiPanelV2Enabled()) {
    return <OutputsDockProviderHost />
  }
  return <OutputsDockLegacyHost />
}

/**
 * FF-on host: consumes the singleton conversation from the
 * `<ConversationProvider>` mounted at the canvas root. Never calls
 * `useConversation()`. Throws if the provider is missing (which would
 * indicate a wiring bug — the provider must always wrap the dock under
 * FF-on).
 */
function OutputsDockProviderHost() {
  const { sendMessage } = useConversationContext()
  return <OutputsDockBody sendMessage={sendMessage} />
}

/**
 * FF-off host: owns its own `useConversation()` instance (legacy path —
 * matches origin/staging behaviour before the floating-first port).
 */
function OutputsDockLegacyHost() {
  const { sendMessage } = useConversation()
  return <OutputsDockBody sendMessage={sendMessage} />
}

interface OutputsDockBodyProps {
  sendMessage: (text: string) => Promise<void> | void
}

function OutputsDockBody({ sendMessage }: OutputsDockBodyProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [state, setState] = useDockState<OutputsDockState>(STORAGE_KEY, {
    isOpen: true,
    activeTab: 'results',
  })
  // sendMessage comes from props so the OutputsDock function above is
  // the single useConversation() host; OutputsDockBody never calls it
  // directly. Under the aiPanelV2 floating-first UX, the canvas-root
  // ConversationProvider becomes the singleton instead — see
  // ReactFlowGraph.tsx.

  // Tab guards: if persisted tab references a disabled flag, reset to 'results'
  useEffect(() => {
    if (state.activeTab === 'journey' && !isJourneyTabEnabled()) {
      setState(prev => ({ ...prev, activeTab: 'results' }))
    }
    if (state.activeTab === 'compare' && !isCompareTabEnabled()) {
      setState(prev => ({ ...prev, activeTab: 'results' }))
    }
    if (state.activeTab === 'olumi' && !isAiPanelV2Enabled()) {
      setState(prev => ({ ...prev, activeTab: 'results' }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- one-time init guard

  // (UX correction P0 redirect effect is mounted later, after the
  // floatingPanelIsOpen subscriber is declared — keeps Rules of Hooks
  // happy with the deps array.)

  // E1: Sync external tab changes from Zustand store (programmatic navigation).
  // Also watches activeOutputTabVersion so `forceActivateOutputTab` triggers
  // the sync even when the tab value itself didn't change — e.g. auto-dock
  // wants 'results' and global is already 'results' but the dock has a
  // different tab persisted to localStorage.
  const externalTab = useUIStore(s => s.activeOutputTab)
  const externalTabVersion = useUIStore(s => s.activeOutputTabVersion)
  const prevExternalTabRef = useRef(externalTab)
  const prevExternalVersionRef = useRef(externalTabVersion)
  useEffect(() => {
    const tabChanged = externalTab !== prevExternalTabRef.current
    const versionChanged = externalTabVersion !== prevExternalVersionRef.current
    if (!tabChanged && !versionChanged) return
    prevExternalTabRef.current = externalTab
    prevExternalVersionRef.current = externalTabVersion
    // ROADMAP 2.639 — a forced activation must also make the dock VISIBLE.
    //
    // The aside carries `hidden` (display:none) whenever an overlay right-panel
    // is active (`isOverlayPanelActive`, this file). Auto-dock already clears it
    // — see the `openRightPanel('results')` on the auto-open path below, "Task F
    // ... close overlay panels so OutputsDock becomes visible". This effect, the
    // OTHER programmatic-navigation entry point, did not; and it is the one the
    // 0.32.0 panel verbs (`open_panel` / `open_section`) ride, via
    // `forceActivateOutputTab`. With the provenance or clarifier hub open the
    // assistant "opened" a panel behind display:none: the turn reported success
    // and nothing on screen moved.
    //
    // ⚠ VERSION-COUNTER PATH ONLY, deliberately. `setActiveOutputTab` does not
    // bump `activeOutputTabVersion` (uiStore.ts), so a plain value sync leaves a
    // hub the user opened for themselves exactly where they put it. Closing an
    // overlay is a claim on the user's screen, and only navigation that has
    // already decided to front the dock is entitled to make it.
    if (versionChanged) {
      useUIStore.getState().openRightPanel('results')
    }
    // Validate the requested tab is enabled before navigating
    const resolvedTab = (externalTab === 'compare' && !isCompareTabEnabled())
      || (externalTab === 'journey' && !isJourneyTabEnabled())
      || (externalTab === 'olumi' && !isAiPanelV2Enabled())
      ? 'results'
      : externalTab
    setState(prev => {
      if (prev.activeTab === resolvedTab && prev.isOpen) return prev
      return { ...prev, isOpen: true, activeTab: resolvedTab as OutputsDockTab }
    })
  }, [externalTab, externalTabVersion, setState])


  // Phase 1A.5: Debug controls visibility (Shift+D shortcut)
  const { showDebug } = useDebugShortcut()

  // Phase 2 Sprint 1B: Slow-run UX feedback (20s/40s thresholds)
  const runStartTimeRef = useRef<number | null>(null)

  // Transition bridge: snapshot of pre-analysis review progress captured at run time
  const transitionBridgeRef = useRef<{ verifiedCount: number; influenceCoverage: number }>({ verifiedCount: 0, influenceCoverage: 0 })

  // Phase 2: Response warnings banner dismissal state
  const [warningsDismissed, setWarningsDismissed] = useState(false)
  // P2: Degraded/partial state banner dismissal
  const [degradedBannerDismissed, setDegradedBannerDismissed] = useState(false)
  const scenarioComparison = useScenarioComparison()

  // Brief 25: Fetch robustness data for sensitivity, VoI, robustness bounds
  // Uses runMeta.runId and results hash when available
  const results = useCanvasStore(s => s.results)
  const robustnessRunId = results?.hash ? `run-${results.hash.slice(0, 8)}` : undefined
  useRobustness({
    runId: robustnessRunId,
    responseHash: results?.hash,
    autoFetch: true,
  })

  // React #185 FIX: Combine state selectors with shallow comparison
  // Using individual selectors for objects (runMeta, graphHealth, etc.) caused
  // infinite re-render loops in production builds because Zustand v5's
  // useSyncExternalStore triggers re-renders when object references change,
  // even if contents are identical. The shallow comparator prevents this.
  const {
    runMeta,
    graphHealth,
    showResultsPanel,
    showComparePanel,
    hasCompletedFirstRun,
    nodes,
    edges,
    framing,
  } = useCanvasStore(
    useShallow(s => ({
      runMeta: s.runMeta,
      graphHealth: s.graphHealth,
      showResultsPanel: s.showResultsPanel,
      showComparePanel: s.showComparePanel,
      hasCompletedFirstRun: s.hasCompletedFirstRun,
      nodes: s.nodes,
      edges: s.edges,
      framing: s.currentScenarioFraming,
    }))
  )

  // Actions don't need shallow - they're stable references
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)
  const setShowComparePanel = useCanvasStore(s => s.setShowComparePanel)
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const applyAutoFixChanges = useCanvasStore(s => s.applyAutoFixChanges)
  // P2: Success target affordance - threshold update
  const setGoalThreshold = useCanvasStore(s => s.setGoalThreshold)
  const setActiveGuidanceItem = useGuidanceStore(s => s.setActiveGuidanceItem)

  // Derived values from runMeta
  const diagnostics = runMeta.diagnostics
  const correlationIdHeader = runMeta.correlationIdHeader
  const effectiveCorrelationId = correlationIdHeader || diagnostics?.correlation_id
  const hasTrim = diagnostics?.trims === 1
  const hasDiagnostics = !!diagnostics
  const correlationMismatch = !!(
    diagnostics?.correlation_id &&
    correlationIdHeader &&
    diagnostics.correlation_id !== correlationIdHeader
  )

  const isPreRun = !hasCompletedFirstRun
  // Empty state: hide panel when canvas has no nodes (FF off).
  const hasGraphContent = nodes.length > 0

  // aiPanelV2 first-use derivation. When the floating-first UX is ON and
  // there's no graph + no real (non-synthetic) messages, the dock collapses
  // to its 40px rail and the floating composer becomes the entry point.
  // The collapse is NOT persisted — derived per render so returning users
  // with an empty canvas only see the rail until they explicitly engage.
  const aiPanelV2On = isAiPanelV2Enabled()
  const conversationCtxForFirstUse = useOptionalConversationContext()
  const realMessageCount = conversationCtxForFirstUse
    ? conversationCtxForFirstUse.messages.filter((m) => !m.synthetic).length
    : 0
  // First-use ends only when graph content exists OR the user explicitly
  // expands the dock (via the rail's chevron). We do NOT use realMessageCount
  // here — the brief is explicit that the empty Analysis tab should not flash
  // after a user message but before the graph builds.
  const userExplicitlyOpenedRailRef = useRef(false)
  const isFirstUse = aiPanelV2On && !hasGraphContent && !userExplicitlyOpenedRailRef.current
  // realMessageCount kept for downstream consumers (Olumi tab empty-state
  // logic); intentionally does NOT participate in isFirstUse.
  void realMessageCount

  // Visual open state: first-use forces the collapsed rail WITHOUT writing the
  // persisted preference (a returning user with an empty canvas must still get
  // the rail). Defined once here and reused by the docked-Olumi close-effect
  // below, the --dock-right-offset effect, and render.
  const effectiveIsOpen = isFirstUse ? false : state.isOpen

  // Round 3 UX correction: clicking the Olumi tab CLOSES the floating panel
  // and shows the docked Olumi conversation (see handleTabClick). For the
  // non-click paths (programmatic setActiveOutputTab, persisted state on
  // page load) we add a guard effect below so the duplicate-readable-
  // surface invariant ("never both at once") still holds.
  const effectiveActiveTab = state.activeTab

  // Track the last non-Olumi tab the user was on so the docked-Olumi
  // float-out path can return them to that context (Analysis / Compare /
  // Model / Journey) rather than always defaulting to Analysis.
  const lastNonOlumiTabRef = useRef<OutputsDockTab>(
    state.activeTab !== 'olumi' ? state.activeTab : 'results',
  )
  useEffect(() => {
    if (state.activeTab !== 'olumi') lastNonOlumiTabRef.current = state.activeTab
  }, [state.activeTab])
  // Retire the floating/hero Olumi surface ONLY when the docked composer will
  // actually take over — i.e. dockHostsOlumi: the Olumi tab is selected AND the
  // dock is showing its body (effectiveIsOpen), not the empty-canvas/collapsed
  // rail. Closing it whenever the tab is merely selected (the old behaviour)
  // strands the user with zero composers on the rail. The singleton
  // ConversationContext preserves draft + message state, so this is a clean
  // surface switch with no data loss. Single source of truth: olumiSurface.ts.
  useEffect(() => {
    if (!dockHostsOlumi({ dockEffectiveOpen: effectiveIsOpen, dockTab: state.activeTab })) return
    if (useFloatingPanelState.getState().isOpen) {
      useFloatingPanelState.getState().close()
    }
  }, [state.activeTab, effectiveIsOpen])
  // Symmetric RE-ENGAGE (empty-canvas never-zero guarantee). When the dock is
  // NOT hosting the Olumi composer (collapsed rail or a non-Olumi tab) and no
  // surface is open, an EMPTY canvas must re-open the first-use hero. Without
  // this, opening the dock to Olumi and then collapsing it strands the user
  // with zero composers: the close-effect above retired the hero, and
  // FirstUseComposer's one-shot auto-open won't re-fire. Empty-canvas only — a
  // populated canvas keeps the deliberate "collapsed; reopen from the rail"
  // state (resolveOlumiSurface → 'none'). A user-opened floating panel (isOpen
  // already true) is left untouched. Mirrors the close-effect; together they
  // keep exactly one Olumi composer on an empty canvas. SoT: olumiSurface.ts.
  useEffect(() => {
    if (hasGraphContent) return
    if (dockHostsOlumi({ dockEffectiveOpen: effectiveIsOpen, dockTab: state.activeTab })) return
    if (!useFloatingPanelState.getState().isOpen) {
      useFloatingPanelState.getState().open('system-first-use')
    }
  }, [hasGraphContent, state.activeTab, effectiveIsOpen])
  const openFloatingByUser = useFloatingPanelState((s) => s.open)

  // First-touch response signal (collapsed-dock defect). On the empty-canvas
  // first-use journey the dock is the collapsed rail and the floating hero
  // (FirstUseComposer) — which has NO transcript — is the entry point. When the
  // user sends a brief and CEE replies with a clarify_v2 question + chips (a
  // conversational turn that drafts no graph), that response renders ONLY in the
  // collapsed Olumi tab: the user typed, the spinner ended, and nothing visibly
  // happened. A DRAFT turn masks the same gap (canvas populates + the 0→N
  // reposition force-activates Analysis); a clarify turn adds no nodes, so
  // neither fires. Surface it by docking the Olumi tab — the same rail-override
  // drop + tab-dock the user's own chevron-expand performs (toggleOpen).
  //
  // The same gap swallows a FAILED turn: when the send times out / errors, the
  // "Not delivered" marker + Retry + recovery guidance render only inside the
  // collapsed dock (the user typed, waited, and saw nothing). An invisible error
  // is worse than an invisible question, so a failed turn surfaces the same way
  // (latestRealMessageIsFailedTurn) — a distinct predicate, never a loosening of
  // the assistant-reply scan.
  //
  // The decision + both message scans are pure/tested helpers
  // (collapsedResponseSignal.ts); this effect only gathers inputs and, on the
  // true→false isThinking EDGE of a live send, acts. The edge is the reliable
  // "user's own composer send" discriminator — hydration/session-resume set
  // isThinking=false without a preceding true, so a page load never trips it,
  // and a background/system failure (which adds no user bubble) surfaces nothing.
  const conversationIsThinking = conversationCtxForFirstUse?.isThinking ?? false
  const prevConversationThinkingRef = useRef(conversationIsThinking)
  const conversationMessagesRef = useRef(conversationCtxForFirstUse?.messages)
  conversationMessagesRef.current = conversationCtxForFirstUse?.messages
  const floatingPanelIsOpen = useFloatingPanelState((s) => s.isOpen)
  const floatingPanelSource = useFloatingPanelState((s) => s.source)
  const floatingPanelMinimised = useFloatingPanelState((s) => s.isMinimised)
  useEffect(() => {
    const wasThinking = prevConversationThinkingRef.current
    prevConversationThinkingRef.current = conversationIsThinking
    const thinkingSettled = wasThinking && !conversationIsThinking
    // A floating panel showing its own transcript already displays the reply —
    // the transcript-less first-use hero (source 'system-first-use') does not.
    const floatingTranscriptVisible =
      floatingPanelIsOpen && !floatingPanelMinimised && floatingPanelSource !== 'system-first-use'
    const surface = shouldAutoExpandDockForResponse({
      aiPanelV2On,
      thinkingSettled,
      dockCollapsed: !effectiveIsOpen,
      hasGraphContent,
      floatingTranscriptVisible,
      hasAssistantReply: latestRealMessageIsAssistantReply(conversationMessagesRef.current),
      hasFailedTurn: latestRealMessageIsFailedTurn(conversationMessagesRef.current),
    })
    if (!surface) return
    // Same override the user's explicit rail-expand uses: drop the first-use
    // rail lock for the session and dock the Olumi tab. The close-effect above
    // then retires the first-use hero, leaving exactly one Olumi surface.
    userExplicitlyOpenedRailRef.current = true
    setState((prev) => ({ ...prev, isOpen: true, activeTab: 'olumi' }))
    useUIStore.getState().setActiveOutputTab('olumi' as OutputTab)
  }, [
    conversationIsThinking,
    aiPanelV2On,
    effectiveIsOpen,
    hasGraphContent,
    floatingPanelIsOpen,
    floatingPanelSource,
    floatingPanelMinimised,
    setState,
  ])

  // Round-14: coordinates a user-initiated float-out from ANY trigger
  // (the OlumiTabBody float-out icon, the persistent strip's chevron, the
  // strip's redirect-mode button click). When the active dock tab is
  // 'olumi', we must swap it to a non-Olumi fallback BEFORE opening the
  // floating panel — otherwise FloatingOlumiPanel's render-time
  // yieldToDockedOlumi guard suppresses the panel mount and the user
  // sees nothing. The sessionStorage write is synchronous so the
  // floating panel's persisted-state fallback read agrees with the
  // React state on the very first render (useDockState's effect-based
  // write would land too late). When activeTab is not 'olumi', the
  // swap is skipped — just opens the panel.
  const floatOutToWindow = () => {
    if (state.activeTab === 'olumi') {
      const fallback = lastNonOlumiTabRef.current
      try {
        const cur = JSON.parse(sessionStorage.getItem(OUTPUTS_DOCK_STORAGE_KEY) || '{}')
        sessionStorage.setItem(
          OUTPUTS_DOCK_STORAGE_KEY,
          JSON.stringify({ ...cur, activeTab: fallback }),
        )
      } catch {
        // sessionStorage blocked (private mode, quota). The React
        // setState below still runs; useDockState's effect catches up.
      }
      setState((prev) => ({ ...prev, activeTab: fallback }))
      useUIStore.getState().setActiveOutputTab(fallback as OutputTab)
    }
    openFloatingByUser('user')
  }

  const transitionReceipt = useTransitionReceipt((s) => s.receipt)
  // Cog popover anchor — strip footer-stack only.
  const [cogAnchor, setCogAnchor] = useState<HTMLElement | null>(null)
  const handleCogClick = useCallback((anchorEl: HTMLElement) => {
    setCogAnchor((prev) => (prev === anchorEl ? null : anchorEl))
  }, [])
  const handleCogClose = useCallback(() => setCogAnchor(null), [])

  // Factors needing user verification (for Model tab badge)
  const factorsToVerify = useMemo(
    () => countFactorsToVerify(nodes.filter(n => n.type === 'factor' || (n.data as any)?.kind === 'factor')),
    [nodes],
  )

  const resultsStatus = useCanvasStore(selectResultsStatus)
  // Wave1-L2: the run's TRUE start, so the banner narrates the age of the RUN
  // rather than the age of the banner (survives remounts and tab switches).
  const resultsStartedAt = useCanvasStore(selectResultsStartedAt)
  const report = useCanvasStore(selectReport)
  const error = useCanvasStore(selectError)
  const resultsSource = useCanvasStore(selectResultsSource)

  // A.9: Auto-dismiss conversation indicator after 5 seconds
  const [convIndicatorVisible, setConvIndicatorVisible] = useState(false)
  const prevResultsSourceRef = useRef<'direct' | 'conversation' | undefined>(undefined)
  useEffect(() => {
    if (resultsSource === 'conversation' && prevResultsSourceRef.current !== 'conversation') {
      setConvIndicatorVisible(true)
      const id = setTimeout(() => setConvIndicatorVisible(false), 5000)
      return () => clearTimeout(id)
    }
    prevResultsSourceRef.current = resultsSource
    return undefined
  }, [resultsSource])

  // C.1b: Supabase persistence callbacks for analysis results
  const {
    setAnalysisRunning,
    resetAnalysisStatus,
    persistAnalysisSuccess,
    persistAnalysisFailure,
    isPersistenceActive: _isPersistenceActive,
    flushPendingSaves,
  } = useScenario()

  // Results-surface staleness is driven by the CEE freshness slice (the single
  // source of truth) via the same fresh→unknown dirty rule as AnalysisFreshnessNotice
  // — NOT by the local `graphEditedSinceLastRun` flag, which fabricated 'stale' and
  // could contradict the CEE-only notice (e.g. a validated patch + CEE 'fresh' showed
  // "reflects the current model" alongside "may not reflect your current graph").
  // The results may be outdated when the displayed verdict is 'stale' (CEE) or
  // 'unknown' (cannot-confirm: a local edit downgraded a fresh verdict, or CEE
  // could not determine freshness). 'fresh'/'none'/null → not stale.
  const ceeFreshness = useCanvasStore(s => s.analysisFreshness)
  const freshnessDirty = useCanvasStore(s => s.analysisFreshnessDirty)
  const displayedFreshness = resolveDisplayedFreshness(ceeFreshness, freshnessDirty)
  const analysisNotConfirmedFresh = displayedFreshness === 'stale' || displayedFreshness === 'unknown'
  // Anchor-run-control (Paul, 21-Jul): the sticky bottom AnalysisFooter is the
  // SOLE Rerun owner in every post-run state — it carries the robustness
  // verdict AND the Rerun action together, and being OUTSIDE the scroller it is
  // the tab's most reliable always-visible recovery affordance. The freshness
  // strip (AnalysisFreshnessNotice) still states fresh/stale/unknown but no
  // longer renders a Rerun, so there is exactly one Rerun and no duplicate.
  // Within the not-fresh window, distinguish a model that definitely CHANGED since
  // the run (CEE 'stale' or a local edit that downgraded a retained 'fresh') from a
  // CANNOT-CONFIRM state where CEE could not determine freshness — so the stale
  // banner never claims "you've updated the model" for a CEE-sourced 'unknown'.

  // Build persistence object only when Supabase persistence is active
  const v2Persistence = useMemo<V2RunPersistence | undefined>(() => {
    if (!_isPersistenceActive) return undefined
    return {
      setAnalysisRunning,
      resetAnalysisStatus,
      persistAnalysisSuccess,
      persistAnalysisFailure,
    }
  }, [_isPersistenceActive, setAnalysisRunning, resetAnalysisStatus, persistAnalysisSuccess, persistAnalysisFailure])

  // P0-UI: V2 run hook for /v2/run endpoint. isRunning is the hook's OWN
  // in-flight flag (true only during a V2 request) — 1.16i gates the Cancel
  // button on it because cancelRun can only abort the V2 request; rendering
  // Cancel for a V5 analysing turn would be a dead control.
  const { runV2Analysis, cancelRun, isRunning: isV2RunInFlight } = useV2Run(v2Persistence)

  // Results Panel Redesign: Section data hook for RecommendationSection, DriversSection, ConfidenceSection
  const resultsSectionData = useResultsSectionData()
  // Wave 1: decision title for the overview card — same source as the
  // ScenarioSwitcher header (scenario name; null when unsaved/untitled).
  // Memoised: getScenario parses the whole scenarios localStorage blob, so
  // it must never run per render (review B1); flag-off renders skip it via
  // the mount-site gate below.
  const overviewScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const overviewTitle = useMemo(
    () => (isDecisionOverviewEnabled() && overviewScenarioId ? (getScenario(overviewScenarioId)?.name ?? null) : null),
    [overviewScenarioId],
  )

  // Tornado chart: Derive per-factor outcome bounds from driver influence and recommended option range.
  // Each factor's contribution to the outcome swing is proportional to its normalised influence.
  const tornadoData = useMemo<{ rows: TornadoRow[]; expectedOutcome: number | null }>(() => {
    const rec = resultsSectionData?.recommendation
    const drv = resultsSectionData?.drivers
    if (!rec?.recommendedOption || !drv?.drivers?.length) {
      return { rows: [], expectedOutcome: null }
    }
    const expected = rec.recommendedOption.expected
    const p10 = rec.recommendedOption.outcome?.p10
    const p90 = rec.recommendedOption.outcome?.p90
    if (expected == null || p10 == null || p90 == null) {
      return { rows: [], expectedOutcome: null }
    }
    const downRange = expected - p10  // distance from expected to pessimistic
    const upRange = p90 - expected    // distance from expected to optimistic

    // Codex final-audit B1: order + size by the SHARED display influence
    // (driverDisplayModel) — the same number the panel, hero and graph badge
    // use — so this chart can never contradict them under partial coverage.
    const infl = (d: (typeof drv.drivers)[number]) =>
      d.displayInfluence ?? d.influenceScore ?? d.normalisedInfluence
    const rows: TornadoRow[] = [...drv.drivers]
      .filter(d => infl(d) > 0.01)
      .sort((a, b) => infl(b) - infl(a))
      .slice(0, 5) // Cap at 5 rows for readability
      .map(d => {
        const influence = infl(d)
        // NOTE: lowOutcome/highOutcome represent outcome at the factor's low/high
        // raw value, NOT "worse/better" from the user's perspective.
        // For negative-direction factors (e.g. churn), low factor value = better
        // outcome, but the rendering assumes lowOutcome < expected < highOutcome.
        // Fixing the semantic mapping requires adding direction to TornadoRow and
        // making the render layer direction-aware (swap bar colours). Deferred to
        // Phase 3.3 alongside drag interaction work.
        return {
          factorKey: d.factorKey,
          label: d.factorLabel,
          lowOutcome: expected - influence * downRange,
          highOutcome: expected + influence * upRange,
          canFocus: d.canFocus,
          matchedNodeId: d.matchedNodeId,
          direction: d.direction === 'negative' ? 'negative' as const : 'positive' as const,
        }
      })

    return { rows, expectedOutcome: expected }
  }, [resultsSectionData?.recommendation, resultsSectionData?.drivers])

  // Graph Interaction P1: Canvas → Results sync for DriversSection
  const [driversExpanded, setDriversExpanded] = useState(false)
  // Brief 5.8B D7: persist expert toggle state to localStorage. Lazy
  // initialiser reads the stored value on first render so the visible
  // toggle never flickers from false → true after hydration. Persist on
  // change via useEffect; the storage key is global (`olumi.expertMode`)
  // so the user's preference is shared across decisions.
  const [expertMode, setExpertMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('olumi.expertMode') === 'true'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('olumi.expertMode', String(expertMode))
    } catch {
      // localStorage may be blocked (private mode, quota, etc.) — silently
      // fall back to in-memory state for this session.
    }
  }, [expertMode])
  const { highlightedDriverId, registerDriverRef } = useCanvasResultsSync({
    drivers: resultsSectionData.drivers.drivers,
    isAccordionExpanded: driversExpanded,
    onExpandAccordion: () => setDriversExpanded(true),
  })

  const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

  // Wave1-L2 (seam D-M): exactly ONE run-status region, now mounted for
  // EVERY in-flight run rather than only when a previous report is on
  // screen — a first run used to be silent until 20s. See
  // analysisRunStatus.ts for why the dock's own slow-run copy was deleted
  // rather than kept alongside it.
  const runStatus = runStatusRegion({ isRunning })

  // ROADMAP 2.635 — `stale` feeds the gate's COPY (I-3) and `verdictAtMs`
  // identifies WHICH verdict licensed a run (I-4).
  const { readiness, stale: readinessStale, verdictAtMs: readinessVerdictAtMs } = useGraphReadiness()

  // C1 review: the orphan-banner footer suppression is GONE. It rested on a
  // premise that is false at this ref — it claimed the footer would carry
  // "duplicate stale messaging", but the footer's label comes from
  // `derivePostFooterStatus(robustnessVerdict)`, which only ever emits
  // robustness copy ('Stable ranking' / 'Ranking sensitive to assumptions' /
  // 'Robustness not assessed' / 'Robustness unknown') and never freshness.
  // Its meta is the producer's robustness reason. Neither duplicates the
  // banner's "Refresh analysis · Coaching may be out of date".
  //
  // The suppression's only REAL effect was CTA dedupe against the banner's
  // own "Run analysis" — and the footer already carries its own robustness
  // verdict + producer meta (never freshness copy), so suppressing the whole
  // footer would have deleted the verdict + the anchor's Rerun, which the
  // anchor-run-control fix says must STAY.
  //
  // It must not come back as an action-level gate either. AnalysisOrphanBanner
  // (deleted in the F11 fold) mounted inside ResultsBody — INSIDE the
  // scroller — so it scrolled away. Letting a scrolling surface suppress the
  // footer's action would recreate the exact zero-affordance blocker this
  // lane fixed: the footer is the tab's only always-visible Rerun owner (it
  // sits outside the scroller) and must never yield its action.
  //
  // Net: banner + footer can coexist — which is precisely what the base
  // already did on the legacy path, deliberately ("the legacy
  // DecisionConfidencePanel path stays unaffected"). All paths now agree.

  // Unified run gating — same function used by ConversationPanel/ChatComposer.
  const hasValidationBlockers = useCanvasStore(s =>
    s.graphHealth?.issues?.some((i: { severity: string }) => i.severity === 'error' || i.severity === 'blocker') ?? false
  )

  // Options the readiness verdict graded as not-yet-ready, joined to the labels
  // the user actually sees. Feeds ONLY the blocked-state COPY (never `allowed`)
  // so the panel can name the real remedy instead of showing the engine's
  // refusal sentence. `ceeAnalysisReady` is the very payload readinessStore
  // sends as `analysis_ready`, so this is the verdict's own input, not a second
  // source of truth.
  const ceeAnalysisReadyForCopy = useCanvasStore(s => s.ceeAnalysisReady)
  const optionsNeedingValues = useMemo(() => {
    const labelById = new Map<string, string>()
    for (const n of nodes) {
      const data = n.data as Record<string, unknown> | undefined
      if (typeof data?.label === 'string') labelById.set(n.id, data.label)
    }
    return selectOptionsNeedingValues(ceeAnalysisReadyForCopy, labelById)
  }, [ceeAnalysisReadyForCopy, nodes])

  // ROADMAP 2.122 — the run gate must stay shut while a streamed draft's
  // structure is on the canvas but its numbers have not settled. The PHASE is
  // handed to the gate unexamined: which phases count as unsettled is
  // `canRunAnalysis`'s decision to make, in one tested place, not a two-clause
  // expression re-derived at every call site. (A mutant that dropped one clause
  // from an earlier version of that expression, right here, survived the
  // battery — nothing tested this component's copy of the rule.)
  // Review F2: scoped to the OPEN scenario — an unsettled draft on another
  // scenario must not reach this gate at all. `draftStreamPhaseFor` owns that
  // decision; re-deriving it here is what M15/M16 punished.
  const draftStreamPhase = useDraftStore((s) => draftStreamPhaseFor(s, overviewScenarioId))

  const runGateResult = canRunAnalysisUtil({
    graphHealth: graphHealth ?? null,
    readiness,
    hasBlockers: hasValidationBlockers,
    nodeCount: nodes.length,
    isRunning,
    ceeCannotSeeModel: computeCeeCannotSeeModel(nodes),
    draftStreamPhase,
    optionsNeedingValues,
    readinessStale,
  })
  // ROADMAP 2.635 (I-4) — the identity of the verdict this gate result was
  // computed against, captured at the same moment so the two cannot drift.
  const licensedByVerdict = useMemo<ReadinessVerdictLicence>(
    () => ({ verdictAtMs: readinessVerdictAtMs, stale: readinessStale }),
    [readinessVerdictAtMs, readinessStale],
  )
  const canRunAnalysis = runGateResult.allowed
  const runBlockedTooltip = getRunButtonTooltip(runGateResult)
  const showToast = useShowToastSafe()

  // Handle Run button click
  //
  // v5-canonical-analysis brief: when VITE_V5_CANONICAL_ANALYSIS=true AND
  // VITE_ENABLE_V5_ORCHESTRATOR=true, the Run path emits a chip-shaped
  // dispatch (action_type: 'run_analysis', source: 'chip') so CEE persists
  // a run_analysis fact and Phase 3 coaching can attach. This is the EXACT
  // same payload shape the suggested-chips emit — we do NOT route through
  // free-text LLM, and we do NOT use a generic conversation message
  // (per correction 1).
  //
  // When the canonical flag is off, behaviour is unchanged: direct V2.
  //
  // Run-path convergence: this is THE canonical runner. It is registered in
  // canonicalRunRegistry so every other visible run affordance (canvas
  // ⌘Enter, command palette) executes this exact pipeline instead of
  // building its own request. It never no-ops silently: a blocked gate
  // returns the human-readable reason for the caller to surface.
  const runCanonicalAnalysis = useCallback(async (opts?: CanonicalRunOptions): Promise<CanonicalRunOutcome> => {
    if (isRunning) return { status: 'already-running' }
    if (!canRunAnalysis) {
      return { status: 'blocked', reason: runBlockedTooltip || 'Analysis is not available right now.' }
    }
    // F1 barrier: an authenticated user who edits then presses Analyse within
    // the 1500ms autosave debounce would otherwise dispatch a canonical V5 run
    // (scenario_id only, no graph on the wire) that CEE resolves against the
    // PREVIOUS persisted graph. Flush any pending/dirty save and AWAIT it before
    // dispatch. No-op for guests/inactive persistence (their runs carry the
    // graph and are gated elsewhere). A failed flush must NOT proceed to a run
    // of a stale persisted graph — abort with a surfaced reason.
    try {
      await flushPendingSaves()
    } catch (err) {
      console.error('[OutputsDock] pre-run save flush failed; aborting run:', err)
      return {
        status: 'blocked',
        reason: 'Could not save your latest changes. Check your connection and try again.',
      }
    }
    // ── ROADMAP 2.635 (I-4): the run is bound to the verdict that licensed it ──
    //
    // The gate above was evaluated during RENDER. This callback dispatches
    // later, and the `flushPendingSaves()` await immediately above is a real
    // window — a fresh verdict, or a staleness mark, can land inside it. Until
    // now nothing tied the click to the assessment that opened the gate, so a
    // run dispatched against a SUPERSEDED verdict looked exactly like one
    // dispatched against a current one, and a doomed run was un-attributable.
    //
    // The check is deliberately narrow. A moved licence alone does NOT stop the
    // run: staleness marks flip on ordinary canvas churn, and refusing on that
    // would hand the user a Run button that fails whenever they touched
    // anything. It stops only the case that is actually doomed — the licence
    // moved AND the verdict now on screen OBJECTS. That question is asked of
    // `readinessObjectsToRun`, the gate's own rung predicate, so there is still
    // exactly one definition of what a readiness objection is (I-5).
    const licenceAtDispatch = useReadinessStore.getState()
    if (
      verdictLicenceSuperseded(licensedByVerdict, {
        verdictAtMs: licenceAtDispatch.verdictAtMs,
        stale: licenceAtDispatch.stale,
      }) &&
      readinessObjectsToRun(licenceAtDispatch.readiness)
    ) {
      console.warn('[OutputsDock] run licence superseded before dispatch', {
        licensedByVerdictAtMs: licensedByVerdict.verdictAtMs,
        licensedByStale: licensedByVerdict.stale,
        atDispatchVerdictAtMs: licenceAtDispatch.verdictAtMs,
        atDispatchStale: licenceAtDispatch.stale,
      })
      return { status: 'blocked', reason: RUN_LICENCE_SUPERSEDED_REFUSAL }
    }
    // Capture pre-analysis review progress for transition bridge
    const storeState = useCanvasStore.getState()
    const { verifiedCount, influenceCoverage } = computeInfluenceCoverage(
      storeState.nodes,
      storeState.preAnalysisSensitivity?.factor_influence ?? null,
      isTransitionBridgeReviewed,
    )
    transitionBridgeRef.current = { verifiedCount, influenceCoverage }
    // Telemetry counts come from the store snapshot, NOT from render-scope
    // arrays: listing nodes/edges in this callback's deps re-minted the
    // closure (and re-registered the canonical runner) on every drag frame
    // and keystroke, for data only read at run time.
    const optionCount = storeState.nodes.filter((n) => n.type === 'option').length
    // P0.8: Track run started
    trackRunStarted({
      option_count: optionCount,
      node_count: storeState.nodes.length,
      edge_count: storeState.edges.length,
    })
    // P0: Log graph used for observability
    console.warn('[GRAPH_USED_FOR_RUN]', {
      node_count: storeState.nodes.length,
      edge_count: storeState.edges.length,
      option_count: optionCount,
      template_id: (framing as any)?.templateId || 'canvas-graph',
    })

    // Canonical V5 chip-action path. Mirrors what suggested chips do for
    // action_type:'run_analysis' — same chip metadata, same dispatcher.
    const canonical = isV5CanonicalRunPath()
    if (canonical) {
      const dispatch = useGuidanceStore.getState()._dispatchAction
      if (dispatch) {
        // ROADMAP 2.109 — the `goal_threshold` CHIP PARAMETER IS RETIRED.
        // This block used to re-attach the store threshold to every plain run.
        // It is deleted because the parameter was a WRITE-ONLY channel: at CEE
        // staging tip `1ba181e7` the complete manifest of non-test
        // `chip.parameters` readers is two sites — the `add_option` ingress
        // (`route-v2.ts:2684`) and the typed-chip mutation pre-route
        // (`turn-executor.ts:4536`, reader map = set_factor_value /
        // adjust_edge_strength / add_constraint) — and NEITHER is
        // `run_analysis`. The `run_analysis` handler contains zero occurrences
        // of `parameters` or `goal_threshold`.
        //
        // The user's target reaches CEE through the GRAPH (`goal_threshold_raw`,
        // persisted on the goal node), which is the channel that actually closed
        // the defect. DO NOT re-introduce this write: a second writer racing the
        // raw-anchored graph channel is the split-brain class, and it would
        // serve a value nothing reads.
        //
        // The generic `parameters` passthrough deliberately SURVIVES — node
        // chips ship `chip_id` provenance through it.
        const parameters = opts?.parameters
        // Fire-and-forget — the dispatcher streams the response and
        // routeV5Response handles all state mutations. We deliberately do
        // NOT await: the OutputsDock UI subscribes to canvas store status
        // for spinner state.
        dispatch({
          action_type: 'run_analysis',
          // Wave F-B: caller-supplied chip parameters (e.g. `chip_id`
          // provenance from a node chip) ride the canonical dispatch — no
          // surface builds its own pipeline. The former `goal_threshold`
          // example is gone with the parameter itself (ROADMAP 2.109).
          ...(parameters ? { parameters } : {}),
          label: 'Run analysis',
          message: 'Run analysis',
          source: 'chip',
        })
        return { status: 'dispatched' }
      }
      if (import.meta.env.DEV) {
        console.warn(
          '[OutputsDock] canonical flag is on but _dispatchAction is not registered; falling back to V2.',
        )
      }
    }
    await runV2Analysis()
    return { status: 'v2' }
  }, [canRunAnalysis, runBlockedTooltip, isRunning, runV2Analysis, framing, flushPendingSaves, licensedByVerdict])

  // Expose the canonical runner to other surfaces (canvas shortcut, palette).
  useEffect(() => registerCanonicalRunner(runCanonicalAnalysis), [runCanonicalAnalysis])

  const handleRunAnalysis = useCallback(async () => {
    const outcome = await runCanonicalAnalysis()
    if (outcome.status === 'blocked') {
      showToast(outcome.reason, 'warning')
    }
  }, [runCanonicalAnalysis, showToast])


  // P2 Task 1: Handle threshold change and trigger re-run.
  //
  // Commit-only semantics: the upstream input fires this only on a committed
  // change (Apply button / blur), never on live keystrokes. A small debounce
  // ref guards against accidental double-fire (rapid re-Apply within 500ms
  // collapses to one rerun) per v5-canonical-analysis brief correction 6.
  //
  // Routing mirrors handleRunAnalysis: canonical flag ON → chip dispatch,
  // OFF → direct V2.
  const lastThresholdRerunAtRef = useRef<number>(0)
  const handleApplyThreshold = useCallback((threshold: number | null) => {
    const store = useCanvasStore.getState()
    // Codex final-audit B2 — atomic store + goal-node commit (the bare
    // setGoalThreshold updated only the global value, leaving the goal node
    // showing "target missing" after an apply). Lane 5: one shared
    // goal-node resolution (validated to exist).
    const goalNodeId = resolveActiveGoalNodeId(store)
    if (goalNodeId) store.setGoalThresholdAndUpdateNode(goalNodeId, threshold)
    else setGoalThreshold(threshold)
    const now = Date.now()
    if (now - lastThresholdRerunAtRef.current < 500) return
    lastThresholdRerunAtRef.current = now
    // Wave F-B: the threshold rerun goes through the canonical runner like
    // every other run affordance — same gate, same V5/V2 routing. The V2
    // fallback reads store.goalThreshold (UI-SEM-058), already set above.
    //
    // ROADMAP 2.109 — the `goal_threshold` chip parameter is RETIRED (it had
    // no CEE reader for `run_analysis`; see the note in dispatchRunAnalysis).
    // The atomic store + goal-node commit above is what carries the user's
    // target to CEE, through the graph's `goal_threshold_raw`. The
    // normalisation that used to build the chip parameter is deleted with it.
    void runCanonicalAnalysis({
      source: 'apply-threshold',
    }).then((outcome) => {
      // Review (b): the hero copy promises "Applying runs the analysis
      // again" — a gated outcome must say why instead of silently saving
      // the threshold without a rerun.
      if (outcome.status === 'blocked') showToast(outcome.reason)
      else if (outcome.status === 'already-running') {
        showToast('Analysis is already running. Your target is saved; rerun when it finishes.')
      }
    })
  }, [setGoalThreshold, runCanonicalAnalysis, showToast])

  // Lane 3 (SF2) perf — evidence-demanded (rerunContinuity render-count pin):
  // with the body mounted through a run, unstable prop identities defeated
  // ResultsBody's memo on every SSE tick. The focus handler is stable; the
  // corrections snapshot re-reads when a new report lands (its collection
  // cadence — the adapter records them during request building).
  const handleFocusResultNode = useCallback((nodeId: string) => {
    // Fail closed on stale/unknown ids — result payloads can reference
    // elements that no longer exist on this canvas (deleted nodes,
    // recovered sessions with different ids).
    if (!focusExistingTarget(nodeId, 'node')) return
    setHighlightedNodes([nodeId])
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes])
  const strengthCorrectionsForRun = useMemo(() => getStrengthCorrections(), [report])

  // Handle auto-fix for validation issues
  const handleAutoFix = useCallback(async (item: CritiqueItem): Promise<boolean> => {
    // Track that auto-fix was clicked
    trackAutoFixClicked()

    if (!item.code) {
      trackAutoFixFailed()
      return false
    }

    const fixType = determineFixType(item.code)
    if (!fixType) {
      console.warn('[OutputsDock] No auto-fix available for code:', item.code)
      trackAutoFixFailed()
      return false
    }

    const params: AutoFixParams = {
      fixType,
      nodeId: item.node_id,
      edgeId: item.edge_id,
    }

    try {
      const result = executeAutoFix(params, nodes, edges)

      if (result.success) {
        // Use store action instead of direct setState (P1 fix - proper history/undo support)
        applyAutoFixChanges({
          nodes: result.updatedNodes,
          edges: result.updatedEdges,
        })

        trackAutoFixSuccess()
        return true
      }

      console.warn('[OutputsDock] Auto-fix failed:', result.message)
      trackAutoFixFailed()
      return false
    } catch (err) {
      console.error('[OutputsDock] Auto-fix error:', err)
      trackAutoFixFailed()
      return false
    }
  }, [nodes, edges, applyAutoFixChanges])

  const canonicalBands = report?.run?.bands ?? null
  // #353: `.results` must be optional-chained too — a Supabase-hydrated
  // report can lack the bands block entirely (the hydration invariant checks
  // only `status === 'complete' && report`), and the unguarded read
  // hard-crashed the whole canvas. Fail closed to null (verdict below
  // already treats null as "no value"); never fabricate a number.
  const mostLikelyValue = canonicalBands ? canonicalBands.p50 : report?.results?.likely ?? null
  // Lane 3 (SF2): the retained report keeps RENDERING through every status —
  // resultsStart/resultsAnalysing/resultsError/resultsCancelled all preserve
  // `results.report` by contract ("so UI doesn't flash empty"), but the old
  // `status === 'complete'` gate unmounted the whole body on every rerun,
  // wiping subtree state (hero lens choice, the goal-lens auto-switch's
  // transition ref, accordions) and making four shipped surfaces dead code
  // (strip running copy + completion toast, running-banner copy, error
  // stale-banner, footer loading state). Run/err state is conveyed by the
  // banner + strip + aria-busy, never by blanking the results.
  const hasInlineSummary = Boolean(report)
  const goalDirection = getGoalDirection(framing, nodes)
  const isError = resultsStatus === 'error'

  // Phase 1A.1: Compute verdict for VerdictCard
  // Use baseline from framing or default to 0 ("do nothing" scenario)
  const baselineValue = framing?.baseline ?? 0

  const verdict = mostLikelyValue !== null
    ? deriveVerdict({
        outcomeValue: mostLikelyValue,
        baselineValue,
        goalDirection,
      })
    : null

  // Legacy CEE types (deprecated)
  const ceeTrace = runMeta.ceeTrace ?? null
  // M1 CEE Orchestrator types (preferred)
  const ceeTraceV1 = runMeta.ceeTraceV1 ?? null

  // Phase 1 Section 3: CEE degraded state (non-blocking overlay behaviour)
  const ceeDegraded = ceeTrace?.degraded === true || ceeTraceV1?.id_mismatch === true

  // Sprint N P0.1: Decision readiness derived from confidence when available
  const readinessFromConfidence = report?.confidence
    ? mapConfidenceToReadiness(
        {
          level: report.confidence.level.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
          reason: report.confidence.why,
        },
        verdict?.verdict === 'supports'
      )
    : null

  const decisionReadiness = report?.decision_readiness || readinessFromConfidence
  const recommendationStability = (report as any)?.robustness?.recommendation_stability ?? (report as any)?.robustness?.ranking_stability
  // Footer status is driven by the display-safe robustness verdict ONLY
  // (single-source rule — the same `robustnessVerdict` field that drives the
  // certified "Robustness unknown" glyph), NEVER by raw recommendation_stability.
  // The verdict is now the producer's own robustness.display_verdict (PLoT
  // #202, consumed lane 35 fix 3), normalised fail-closed in the hook; when
  // it is absent (older PLoT builds) the footer keeps the neutral
  // "Robustness unknown" state instead of a green "Stable ranking" derived
  // from raw stability (which contradicted the glyph on the same tab). Raw
  // stability is retained only as neutral metadata in derivePostFooterMeta
  // below. See ./utils/postAnalysisFooter.ts + ROBUSTNESS-VERDICT-CONTRACT.
  const postFooterStatus = derivePostFooterStatus(resultsSectionData.recommendation.robustnessVerdict)
  const POST_FOOTER_ICONS = { check: CheckCircle, warning: AlertTriangle, unknown: HelpCircle } as const
  const postRunFooter = {
    icon: POST_FOOTER_ICONS[postFooterStatus.icon],
    iconClass: postFooterStatus.iconClass,
    label: postFooterStatus.label,
  }
  const postRunMetaText = derivePostFooterMeta({
    stability: recommendationStability,
    // Same display-safe verdict as the status above: without a determinate
    // verdict the "{N}% stability" segment is suppressed —
    // "Robustness unknown · 59% stability" contradicted itself (and the raw
    // number is numerically the leader's win probability, not a robustness
    // verdict). Suppress, never relabel.
    robustnessVerdict: resultsSectionData.recommendation.robustnessVerdict,
    // Producer-owned reason phrase, rendered verbatim as the leading meta
    // segment (never authored in the UI).
    robustnessVerdictReason: resultsSectionData.recommendation.robustnessVerdictReason,
    reviewCards: resultsSectionData.confidence.topEvidenceGaps ?? resultsSectionData.confidence.evidenceGaps ?? [],
  })

  // Triage card action handlers — same pattern as pre-analysis expertise (uses withObservedStateUpdate)
  const handleTriageConfirm = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find((n: { id: string }) => n.id === nodeId)
    if (!node) return
    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, { source: 'user_confirmed' }),
    })
  }, [])

  const handleTriageSetValue = useCallback((nodeId: string, rawValue: number) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find((n: { id: string }) => n.id === nodeId)
    if (!node) return
    const nd = node.data as Record<string, unknown>
    const existing = (nd?.observedState ?? nd?.observed_state ?? {}) as Record<string, unknown>
    const cap = (existing.cap as number | null) ?? null
    const normalised = normaliseRawFactorValue(rawValue, cap)
    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, {
        raw_value: rawValue,
        value: normalised,
        source: 'user_override',
      }),
    })
    // Parametric edit — observed state is read from graph nodes at request build time,
    // not from ceeAnalysisReady. Option intervention mappings remain valid.
  }, [])

  // Node value lookup for pre-filling triage card editors with current observed values.
  // Keyed by canvas numeric ID AND by node label (normalised to fac_ snake_case) so that
  // semantic IDs from PLoT evidence gaps (e.g. "fac_current_mrr") can also resolve.
  // Heuristic fallback — remove when PLoT guarantees target_node_id on all evidence gaps.
  const nodeValueLookup = useMemo(() => {
    const lookup: Record<
      string,
      { value: number | null; unit: string | null; cap: number | null; displayValue: string | null }
    > = {}
    for (const n of nodes) {
      const nd = n.data as Record<string, unknown>
      const obs = (nd?.observedState ?? nd?.observed_state ?? {}) as Record<string, unknown>
      const raw = obs?.raw_value as number | undefined
      const val = obs?.value as number | undefined
      // intervention_details[factor_id].display_value — pre-formatted string
      // supplied by CEE/PLoT, preferred over raw-value formatting (Brief 4 T7).
      const intervention = (nd?.intervention_details ?? {}) as Record<string, { display_value?: unknown; unit?: unknown }>
      const ownIntervention = intervention[n.id]
      const interventionDisplay = typeof ownIntervention?.display_value === 'string'
        ? ownIntervention.display_value
        : null
      const interventionUnit = typeof ownIntervention?.unit === 'string' ? ownIntervention.unit : null
      const entry = {
        value: raw ?? val ?? null,
        unit: interventionUnit ?? ((obs?.unit as string | undefined) ?? null),
        cap: (obs?.cap as number | undefined) ?? null,
        displayValue: interventionDisplay,
      }
      lookup[n.id] = entry
      // Secondary key: derive fac_ snake_case ID from label so PLoT semantic IDs match
      const label = nd?.label as string | undefined
      if (label) {
        const facKey = 'fac_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')
        if (!lookup[facKey]) lookup[facKey] = entry
        // Also index by raw label for direct label matches
        if (!lookup[label]) lookup[label] = entry
      }
    }
    return lookup
  }, [nodes])

  // Brief 5.4 Phase 11: "Create decision brief" placeholder removed.
  // confirmLabel / confirmTitle / isConfirmProvisional / confirmGapCount deleted.
  // "Rerun analysis" is the sole primary action in AnalysisFooter.

  verboseDebug('[TrustSignals] OutputsDock', {
    isPreRun,
    hasReport: !!report,
    hasDecisionReadiness: !!decisionReadiness,
    fromConfidence: !!readinessFromConfidence,
    hasGraphQuality: !!report?.graph_quality,
    hasInsights: !!report?.insights,
  })

  useDegeneracyDismissal(robustnessRunId)

  const mappedRobustness: MappedRobustness | null = useMemo(() => {
    const raw = (report as any)?.robustness
    if (!raw) return null
    return mapRobustness(raw, { sourcePath: 'top_level' })
  }, [report])

  const ceeQuality = useCanvasStore(s => s.ceeQuality)

  // ROADMAP 1.7: influence_score (producer-owned, ISL/PLoT) takes priority
  // over elasticity/sensitivity_score/importance_score — see
  // deriveFactorInfluenceMap doctrine comment (model-tab/utils.ts).
  const factorInfluenceMap = useMemo(() => deriveFactorInfluenceMap(report), [report])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const resolveTab = (): OutputsDockTab | null => {
        // Prefer real query string: /canvas?tab=insights
        const searchParams = new URLSearchParams(window.location.search)
        const fromSearch = searchParams.get('tab') as OutputsDockTab | null
        if (fromSearch && OUTPUT_TABS.some(tab => tab.id === fromSearch)) {
          return fromSearch
        }

        // Fallback: read from hash fragment: /#/canvas?tab=insights
        const hash = window.location.hash
        const qIndex = hash.indexOf('?')
        if (qIndex !== -1) {
          const hashQuery = hash.slice(qIndex + 1)
          const fromHash = new URLSearchParams(hashQuery).get('tab') as OutputsDockTab | null
          if (fromHash && OUTPUT_TABS.some(tab => tab.id === fromHash)) {
            return fromHash
          }
        }

        return null
      }

      const initialTab = resolveTab()
      if (!initialTab) return

      setState(prev => {
        if (prev.isOpen && prev.activeTab === initialTab) {
          return prev
        }
        return { ...prev, isOpen: true, activeTab: initialTab }
      })
    } catch {}
    // One-time mount init: read `?tab=` from the URL once and apply.
    // OUTPUT_TABS is now a per-render useMemo (post-floating-first port,
    // the tab list is flag-time-derived), so including it in the deps
    // would re-run the URL parse on every render — wrong shape for an
    // init guard. Matches the `[]`-with-explanation pattern used by the
    // journey/compare/olumi persisted-tab guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState])

  // MERGED EFFECT: Handles both resultsStatus and showResultsPanel dock opening
  // Fix for React #185: Previously two separate effects could cascade and cause infinite loops.
  // Now unified with ref-based debounce to prevent rapid state updates.
  //
  // I.1 Fix: Only auto-switch to Results tab when status *transitions* from
  // idle/cancelled into an active state — not on every render where status is
  // already non-idle. This prevents yanking users off the Structure/Compare tab
  // when they navigate there post-analysis.
  const lastDockOpenRef = useRef<number>(0)
  const prevAutoSwitchStatusRef = useRef(resultsStatus)

  // ROADMAP 2.204 — the bookkeeping the post-run RETURN effect below reads.
  // Kept next to the effect that creates the situation, so the two halves of
  // "we moved them / we move them back" are read together.
  //   - activeTabRef mirrors the selected tab for the effects that carry an
  //     exhaustive-deps disable (their closures over `state` are stale by
  //     construction; the ref is not).
  //   - runAutoSwitchedToAnalysisRef records that THIS run is what moved the
  //     user off their tab. Only a run that actually switched earns a return.
  //   - userInteractedSinceRunRef records deliberate engagement with the dock
  //     since the run started (see the capture handlers on the <aside>).
  const activeTabRef = useRef(state.activeTab)
  activeTabRef.current = state.activeTab
  const runAutoSwitchedToAnalysisRef = useRef(false)
  const userInteractedSinceRunRef = useRef(false)

  useEffect(() => {
    const prevStatus = prevAutoSwitchStatusRef.current
    prevAutoSwitchStatusRef.current = resultsStatus

    const wasInactive = prevStatus === 'idle' || prevStatus === 'cancelled'
    const isNowActive =
      resultsStatus === 'preparing' ||
      resultsStatus === 'connecting' ||
      resultsStatus === 'streaming' ||
      resultsStatus === 'complete' ||
      resultsStatus === 'error'

    // Auto-switch to Results tab only when:
    // 1. Status transitions from idle/cancelled → active (user started a run)
    // 2. showResultsPanel flag is explicitly set (external trigger)
    const statusTransitioned = wasInactive && isNowActive
    if (!statusTransitioned && !showResultsPanel) return

    // Debounce: prevent rapid updates within 50ms (React #185 fix)
    const now = Date.now()
    if (now - lastDockOpenRef.current < 50) {
      return
    }
    lastDockOpenRef.current = now

    // ROADMAP 2.204: record the navigation this effect is ABOUT to perform.
    // Placed after the debounce so the record can never claim a switch that
    // did not happen. A run start also CLEARS the interaction record — the Run
    // control is itself a click inside the dock, and the click that started the
    // run must not be read as "the user is busy on this tab".
    // ⚠ An ASSIGNMENT, never a conditional set. As an `if` this record was
    // only ever raised and never lowered, so it survived a run that produced
    // no block (error / cancel / the useV2Run path): the user sat on Analysis,
    // ran again FROM Analysis — a run that switched nothing and earns no
    // return — and was yanked on the new arrival by the FIRST run's stale
    // record, contradicting this record's own stated invariant. Reachable
    // because `resultsSettle` lands a reportless run on 'idle'
    // (store.ts:3359-3365), which makes the next run's `wasInactive` true.
    // Assigning both ways means the record always describes THIS run.
    if (statusTransitioned) {
      userInteractedSinceRunRef.current = false
      runAutoSwitchedToAnalysisRef.current = activeTabRef.current !== 'results'
    }

    // Task F: Auto-open results — close overlay panels so OutputsDock becomes visible
    useUIStore.getState().openRightPanel('results')

    setState(prev => {
      // Guard: only update if state actually needs to change
      if (prev.isOpen && prev.activeTab === 'results') {
        return prev // No change needed
      }
      // Mutual exclusion: close inspector when dock auto-opens
      if (!prev.isOpen) {
        window.dispatchEvent(new Event('outputs-dock-opened'))
      }
      return { ...prev, isOpen: true, activeTab: 'results' }
    })
    // We intentionally depend on both triggers. setState from useDockState is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsStatus, showResultsPanel])

  // ROADMAP 2.204 — RETURN the user to the surface the run produced.
  //
  // The effect above navigates AWAY on run start; this one is its counterpart.
  // The turn that completes the analysis puts its output — the decision-review
  // card and the turn's review/coaching cards — in the OLUMI tab, whose wrapper
  // is `hidden` while Analysis is fronted (see the wrapper at the bottom of this
  // file). Live-proven 31 Jul: it stayed at 0 px² for a 180 s poll with the
  // analysis complete and never self-revealed, so a tester who clicks Run and
  // stays put never sees it.
  //
  // The trigger is the ARRIVAL of a new analysis-result block, not
  // `resultsStatus === 'complete'`: the non-conversational run path completes
  // the results store while putting nothing in the Olumi tab, and returning a
  // user to an empty surface is worse than leaving them. Decision rules and the
  // full rationale live in runReturnSignal.ts; this effect only gathers inputs.
  const reviewBlockCount = useMemo(
    () => countAnalysisReviewBlocks(conversationCtxForFirstUse?.messages),
    [conversationCtxForFirstUse?.messages],
  )
  const prevReviewBlockCountRef = useRef(reviewBlockCount)
  // ROADMAP 2.204-R3 — the arrival raises a token here; the effect BELOW spends
  // it, once the tab is actually fronted. See that effect for why it cannot be
  // done in this one.
  const [resultScrollToken, setResultScrollToken] = useState(0)
  useEffect(() => {
    const previousCount = prevReviewBlockCountRef.current
    prevReviewBlockCountRef.current = reviewBlockCount
    const shouldReturn = shouldReturnToOlumiAfterRun({
      aiPanelV2On,
      runAutoSwitchedToAnalysis: runAutoSwitchedToAnalysisRef.current,
      dockTab: state.activeTab,
      dockEffectiveOpen: effectiveIsOpen,
      userInteractedSinceRun: userInteractedSinceRunRef.current,
      reviewContentArrived: reviewBlockCount > previousCount,
    })
    if (!shouldReturn) return
    // ROADMAP 2.204-R3 — the scroll rides the RETURN's own decision, verbatim.
    //
    // It was briefly a second predicate that widened the tab clause to admit
    // `dockTab === 'olumi'`. That widening was withdrawn: derived at the bytes,
    // the we-moved-them record has exactly ONE raise (the merged auto-switch
    // effect above, which in the same breath schedules `activeTab: 'results'`),
    // and every other write clears or spends it. So "record true AND tab already
    // Olumi" is reachable only through a stale render closure — the batched
    // flush pinned by this file's ADV-3 spec — where it is harmful, not
    // beneficial. There is no shape in which the widened clause helps, so there
    // is no clause. One decision, no mirror to drift.
    setResultScrollToken((token) => token + 1)
    // Spend the record: one return per run, never a repeat.
    runAutoSwitchedToAnalysisRef.current = false
    setState(prev => ({ ...prev, isOpen: true, activeTab: 'olumi' }))
    useUIStore.getState().setActiveOutputTab('olumi' as OutputTab)
    // The same bookkeeping handleTabClick performs for any non-Results tab.
    // `showResultsPanel` is the merged effect's SECOND trigger, so leaving it
    // true here would let that effect pull the user straight back on the next
    // results-status change.
    if (showResultsPanel) setShowResultsPanel(false)
  }, [
    reviewBlockCount,
    aiPanelV2On,
    state.activeTab,
    effectiveIsOpen,
    showResultsPanel,
    setShowResultsPanel,
    setState,
  ])

  // ROADMAP 2.204-R3 — land the returned tester ON the card, not 2,248 px above
  // it.
  //
  // ## Why this is a SECOND effect and not two lines in the one above
  // The effect above decides to return and calls `setState({activeTab:'olumi'})`.
  // At that moment the DOM still has `hidden` (`display: none`) on the Olumi
  // wrapper — React has not re-rendered yet — and an element inside a
  // `display: none` subtree has no layout box, so a `scrollIntoView` issued there
  // does nothing. That is precisely the defect being fixed: ChatThread's own
  // smart-scroll already fires in that commit and is silently swallowed (see
  // runReturnSignal.ts and the spec's THE CAUSE test, which measures it). This
  // effect depends on `state.activeTab`, so it runs after the commit that
  // REMOVED `hidden` — the first moment the card can actually be scrolled.
  //
  // ## Why a token, spent once
  // `state.activeTab` changes on every manual tab click too. Without a token
  // that is spent, every later click back to Olumi would re-scroll the user onto
  // the card — a yank, and exactly the failure mode 2.204's discipline exists to
  // prevent. The token is raised only by an arrival that passed that discipline,
  // and each token scrolls at most once.
  //
  // ## ⚠ Why the token is marked handled BEFORE the tab guard, not after
  // Because a never-yank verdict has a SHELF LIFE. Every gate the raise passed —
  // "the user has not interacted", "we moved them here" — was true in the commit
  // that raised the token and says nothing about any later commit. So a token
  // that cannot be spent on the very next commit must be DISCARDED, never
  // carried: parked, it would discharge on the user's own next visit to the
  // Olumi tab, minutes later, possibly in a different scenario, after they had
  // wheeled and toured tabs. Marking first makes the token strictly
  // single-shot — spent by being used, or spent by expiring — so its verdict can
  // never outlive the flush it was formed in.
  //
  // Reachability of the unspendable case is not hypothetical: React 18 batches
  // the block's arrival and the results completion into ONE flush, and the
  // merged auto-switch effect above runs first within it, so this effect can see
  // a tab value that is already superseded. Pinned by the ADV-3 / ADV-4 cases in
  // OutputsDock.runReturnsToOlumi.spec.tsx.
  const handledResultScrollTokenRef = useRef(0)
  useEffect(() => {
    if (resultScrollToken === 0) return
    if (handledResultScrollTokenRef.current === resultScrollToken) return
    handledResultScrollTokenRef.current = resultScrollToken
    if (state.activeTab !== 'olumi') return
    scrollAnalysisResultIntoView()
  }, [resultScrollToken, state.activeTab])

  // Effect: Switch to compare tab when showComparePanel flag is set
  useEffect(() => {
    if (!showComparePanel) return

    setState(prev => {
      if (prev.isOpen && prev.activeTab === 'compare') {
        return prev // Already on compare tab
      }
      // Mutual exclusion: close inspector when dock auto-opens
      if (!prev.isOpen) {
        window.dispatchEvent(new Event('outputs-dock-opened'))
      }
      return { ...prev, isOpen: true, activeTab: 'compare' }
    })

    // Reset the flag after switching (one-shot trigger)
    setShowComparePanel(false)
  }, [showComparePanel, setState, setShowComparePanel])

  // Run-duration clock, kept ONLY for the `duration_ms` telemetry on the
  // completed/failed event below.
  //
  // The 20s/40s slow-run MESSAGE this effect used to set is gone.
  // AnalysisRunningBanner is now the single narration for every run (see
  // analysisRunStatus.ts) and derives its own elapsed time from the store's
  // true run start, so a second interval here would be a second stage table
  // to keep in sync — exactly the drift that left the first-run copy saying
  // "Taking longer than expected..." at 20s, a wait that is entirely typical.
  useEffect(() => {
    const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

    if (isRunning) {
      if (runStartTimeRef.current === null) {
        runStartTimeRef.current = Date.now()
      }
    } else {
      // Clear tracking when run completes/errors/cancels/navigates away
      runStartTimeRef.current = null
    }
  }, [resultsStatus])

  // P0.8: Track run completed/failed events
  const prevResultsStatus = useRef(resultsStatus)
  useEffect(() => {
    const prevStatus = prevResultsStatus.current
    prevResultsStatus.current = resultsStatus

    // Detect transition to 'complete'. Lane 3 review fold: a resultless
    // settle restores the RETAINED report at 'complete' — that is not a run
    // completion, and the flag exists to distinguish exactly this.
    if (
      resultsStatus === 'complete' &&
      prevStatus !== 'complete' &&
      report &&
      !useCanvasStore.getState().results.settledWithoutNewReport
    ) {
      // ⚠ 'complete' DOES NOT MEAN 'succeeded' — ROADMAP 1.68.
      //
      // `useV2Run.ts:846-866` (the HTTP-200-but-failed branch) settles a
      // FAILURE through `resultsComplete`, because that is the action which
      // renders the critique list the user needs to see. Emitting
      // run_completed here unconditionally recorded a whole failure class as a
      // success — while the same block persisted `ANALYSIS_FAILED` to Supabase,
      // so the database and the analytics disagreed.
      //
      // `isErrorReport` is owned by the module that BUILDS the error report,
      // so no sentinel string is copied into this file. Exactly one event still
      // fires per settle, so the single-emitter invariant is unchanged.
      if (isErrorReport(report)) {
        // The code is exact, not inferred: `useV2Run`'s branch is the only
        // producer of error reports and it declares ANALYSIS_FAILED. A second
        // producer reds `runSettleClassification.spec.ts`, which is the signal
        // to carry the code on the report instead.
        trackRunFailed({ error_code: 'ANALYSIS_FAILED' })
      } else {
        trackRunCompleted({
          confidence_level: report.confidence?.level as 'high' | 'medium' | 'low' ?? 'medium',
          drivers_informative: areDriversInformative(report.drivers_payload),
          trace_id: runMeta?.correlationIdHeader ?? undefined,
          duration_ms: runStartTimeRef.current ? Date.now() - runStartTimeRef.current : undefined,
        })
      }
    }

    // Detect transition to 'error'
    if (resultsStatus === 'error' && prevStatus !== 'error' && error) {
      trackRunFailed({
        error_code: error.code ?? 'UNKNOWN',
        error_message: error.message,
      })
    }
  }, [resultsStatus, report, error, runMeta?.correlationIdHeader])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    // Reflect VISUAL state (post-first-use override), not persisted preference.
    const visuallyOpen = isFirstUse ? false : state.isOpen
    const value = visuallyOpen ? 'var(--dock-right-expanded)' : 'var(--dock-right-collapsed)'
    root.style.setProperty('--dock-right-offset', value)

    return () => {
      root.style.setProperty('--dock-right-offset', '0rem')
    }
  }, [state.isOpen, isFirstUse])
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('panel.results.width')
      if (!stored) return
      const parsed = Number(stored)
      if (!Number.isFinite(parsed)) return
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
      if (!viewportWidth) return
      const minWidth = 280
      const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
      const clamped = Math.max(minWidth, Math.min(maxWidth, parsed))
      const root = document.documentElement
      root.style.setProperty('--dock-right-expanded', `${clamped}px`)
    } catch {}
  }, [])
  const transitionClass = prefersReducedMotion ? '' : 'transition-[width,opacity] duration-200 ease-in-out'

  // OUTPUT_TABS computed per render so a localStorage flag flip is picked
  // up on the next re-render without requiring a module reload.
  const OUTPUT_TABS = useMemo<{ id: OutputsDockTab; label: string }[]>(
    () => getOutputTabsForParity(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flag accessors are stable; we re-run by value
    [aiPanelV2On, isJourneyTabEnabled(), isCompareTabEnabled()],
  )

  const toggleOpen = () => {
    // Derive nextIsOpen from what the user SEES right now (visual state),
    // not from state.isOpen. During first-use the rail is visible despite
    // state.isOpen=true; flipping state would leave effectiveIsOpen=false
    // and the user would perceive "nothing happened". See deriveNextDockIsOpen.
    const nextVisible = deriveNextDockIsOpen(isFirstUse, state.isOpen)
    // User explicitly chose to expand/collapse the dock — disable the
    // first-use rail override for the rest of the session (without writing
    // anything to localStorage, so returning users still get the rail on
    // a fresh empty canvas).
    userExplicitlyOpenedRailRef.current = true
    setState(prev => {
      const nextIsOpen = nextVisible
      // Keep showResultsPanel in sync primarily for highlighting & telemetry when
      // the dock is explicitly opened or closed. Schedule the store update on a
      // microtask to avoid cascading updates during the same render cycle.
      // Guard: Only update store if value actually changes (React #185 fix)
      Promise.resolve().then(() => {
        const shouldShowResults = nextIsOpen && prev.activeTab === 'results'
        if (shouldShowResults !== showResultsPanel) {
          setShowResultsPanel(shouldShowResults)
        }
      })
      // Mutual exclusion: close inspector when dock expands
      if (nextIsOpen) {
        window.dispatchEvent(new Event('outputs-dock-opened'))
      }
      return { ...prev, isOpen: nextIsOpen }
    })
  }

  // ROADMAP 2.204: any deliberate interaction inside the dock stands the
  // post-run return down. Ref-only — deliberately not state, so it cannot
  // re-render the dock on every keystroke.
  const markDockInteraction = useCallback(() => {
    userInteractedSinceRunRef.current = true
  }, [])

  const handleTabClick = (tab: OutputsDockTab) => {
    // ROADMAP 2.204: an explicit tab choice is the strongest "leave me where I
    // put myself" signal there is, so it spends the auto-switch record outright
    // rather than relying on the pointer/key capture above (which a keyboard
    // activation via click() would not produce).
    runAutoSwitchedToAnalysisRef.current = false
    userInteractedSinceRunRef.current = true
    // UX correction (round 3): clicking the Olumi tab ALWAYS docks the
    // conversation into the right panel. If the floating panel is open,
    // close it first so the conversation surface is unambiguous. The
    // singleton ConversationContext preserves the draft text and message
    // state across the floating-to-docked transition (no data loss).
    if (tab === 'olumi' && useFloatingPanelState.getState().isOpen) {
      useFloatingPanelState.getState().close()
    }
    setState(prev => ({ ...prev, isOpen: true, activeTab: tab }))
    // E1: Sync tab state to Zustand store for cross-component navigation
    useUIStore.getState().setActiveOutputTab(tab as OutputTab)
    // Mutual exclusion: close inspector when dock opens via tab click
    window.dispatchEvent(new Event('outputs-dock-opened'))

    // Treat the Results tab as the canonical "results visible" state for
    // highlight overlays and results-viewed telemetry.
    // Guard: Only update store if value actually changes (React #185 fix)
    const shouldShowResults = tab === 'results'
    if (shouldShowResults !== showResultsPanel) {
      setShowResultsPanel(shouldShowResults)
    }

    if (tab === 'compare') {
      trackCompareOpened()
    }

    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href)
        if (tab === 'results') {
          url.searchParams.delete('tab')
        } else {
          url.searchParams.set('tab', tab)
        }
        window.history.replaceState({}, '', url.toString())
      } catch {}
    }
  }

  const handleResizeStart = (event: any) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    event.preventDefault()

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
    if (!viewportWidth) return

    const minWidth = 280
    const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
    const root = document.documentElement

    const handleMove = (e: MouseEvent) => {
      const fromRight = viewportWidth - e.clientX
      const nextWidth = fromRight
      const clamped = Math.max(minWidth, Math.min(maxWidth, nextWidth))
      root.style.setProperty('--dock-right-expanded', `${clamped}px`)
      try {
        localStorage.setItem('panel.results.width', String(clamped))
      } catch {}
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  // AI panel v2: freshness indicator on the Results tab label. Driven by the CEE
  // freshness verdict + local dirty overlay (displayedFreshness), NOT the legacy
  // graph-hash stale path deleted on 2026-07-16 (_internal.graphHash is never
  // written, so its isStale could never fire and would contradict the
  // CEE-derived Results state).
  // Strictly FF-gated — no behaviour change when FF_AI_PANEL_V2 is off.
  //
  // It MUST distinguish a genuine CEE 'stale' verdict (warning glyph + stale label)
  // from the cannot-confirm overlay state ('unknown' — produced when local edits
  // downgrade a retained 'fresh'), which gets a NEUTRAL glyph + neutral label,
  // mirroring AnalysisFreshnessNotice. Rendering the stale glyph/label for
  // cannot-confirm would fabricate 'stale', which the overlay never does.
  const { reallyStale: resultsTabReallyStale, showIcon: showResultsTabFreshnessIcon } =
    deriveResultsTabFreshness(isAiPanelV2Enabled(), displayedFreshness)

  // Task C: Panel coordination — hide OutputsDock when an overlay panel is active
  const activeRightPanel = useUIStore(s => s.activeRightPanel)
  const isOverlayPanelActive = activeRightPanel === 'provenance' || activeRightPanel === 'clarifier'

  // Empty state: under FF off, unmount when canvas has no nodes. Under
  // aiPanelV2 we keep the dock mounted so the 40px rail can show even
  // before any graph exists (the first-use floating composer is the
  // entry point in that state).
  if (!hasGraphContent && !aiPanelV2On) {
    return null
  }
  // When an overlay panel is active, keep mounted (preserve scroll position,
  // tab state, effect continuity) but hide visually via CSS.

  // effectiveIsOpen is defined once near isFirstUse (above) and reused here.

  const asideStyle: React.CSSProperties = {
    position: 'fixed',
    width: effectiveIsOpen
      ? 'var(--dock-right-expanded, 24rem)'
      : 'var(--dock-right-collapsed, 2.5rem)',
    right: 12,
    top: 12,
    bottom: 'calc(var(--bottombar-h) + 1rem)',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--border-default)',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
    zIndex: 900,
    overflow: 'hidden',
  }

  return (
    <>
      {/* F9: THE single aria-live region for run start/settle, mounted once
          at the dock call site so it survives tab switches and speaks for
          runs dispatched from ANY tab. It is a SIBLING of the aside, not a
          child (review-folds C3): the aside hides with the `hidden` class
          while an overlay panel is active, and display:none removes its
          whole subtree from the accessibility tree — the announcer must
          keep speaking exactly then. It yields while the Analysis tab is
          fronted (except a first-run settle) — that tab's own furniture
          (narration banner, completion toast, error alert) already
          announces there. Rule: runAnnouncementForTransition in
          analysisRunStatus.ts. */}
      <AnalysisRunAnnouncer
        analysisTabFronted={effectiveIsOpen && effectiveActiveTab === 'results'}
      />
    <aside
      className={`${transitionClass} flex flex-col transition-shadow pointer-events-auto${isOverlayPanelActive ? ' hidden' : ''}`}
      style={asideStyle}
      aria-label="Outputs dock"
      data-testid="outputs-dock"
      // ROADMAP 2.204: the honest "the user is engaged here" signal for the
      // post-run return. Capture phase on the dock ROOT, so any pointerdown,
      // keydown or wheel anywhere inside it counts — the tab strip, every
      // Analysis-tab control, the composer, and the scroll region. DERIVED
      // from real events rather than an enumerated list of controls, which
      // would rot the moment one is added and read green while it did
      // (trap 12). Read-only ref writes: no state, no re-render, no
      // interference with any handler.
      //
      // ⚠ WHEEL, NOT SCROLL — and the distinction is load-bearing. The dock
      // body is `overflow-y-auto`, so scroll-reading the Analysis tab while a
      // run finishes is the most likely waiting behaviour there is, and a
      // pointer/key pair cannot see it: that user was yanked mid-read.
      // `onScrollCapture` would be the wrong repair — ChatThread's
      // useSmartScroll fires `scrollIntoView` programmatically
      // (useSmartScroll.ts:33), emitting a `scroll` event with no user behind
      // it, which would stand the return down for exactly the passive tester
      // this row exists to serve. `wheel` only fires for a real gesture, so
      // passive waiting still fires nothing.
      onPointerDownCapture={markDockInteraction}
      onKeyDownCapture={markDockInteraction}
      onWheelCapture={markDockInteraction}
    >
      {/* Parity P7a: the Work-through-it-with-Olumi drawer mounts ONCE at the
          dock root (fixed-position overlay) so asks routed from ANY tab —
          graph node sparkles included — surface visibly instead of
          auto-sending into a conversation the user cannot see. */}
      <AskOlumiDrawer />
      {/* Round-2 wiring: the parity modals mount once at the same root so
          openDefineSuccess()/openDecisionRecord() work from any surface. */}
      <DefineSuccessModal />
      <DecisionRecordModal />
      {/* P1-9: Model-Card-Lite. Mounted at the same root so
          openHowComputed() works from the results header (and, later, from a
          number's own affordance) without prop drilling. */}
      <HowComputedModal />
      {effectiveIsOpen && (
        <div
          aria-hidden="true"
          onMouseDown={handleResizeStart}
          className="absolute inset-y-0 left-0 w-1 cursor-col-resize bg-transparent hover:bg-panel-border/60"
        />
      )}
      <div
        className="sticky top-0 z-10 border-b rounded-t-2xl border-panel-border"
        style={{ background: 'rgba(255, 255, 255, 0.95)' }}
      >
        {!effectiveIsOpen && (
          <div className="flex items-center justify-end px-2 py-2">
            <button
              type="button"
              onClick={toggleOpen}
              className={`inline-flex items-center justify-center w-6 h-6 rounded border border-panel-border ${typography.caption} text-text-header hover:bg-panel`}
              aria-label={effectiveIsOpen ? 'Collapse outputs dock' : 'Expand outputs dock'}
            >
              {effectiveIsOpen ? '>' : '<'}
            </button>
          </div>
        )}

        {effectiveIsOpen && (
          <div className="flex items-center gap-2 px-2 py-2" aria-label="Outputs sections">
            <span className="sr-only" aria-live="polite">
              {OUTPUT_TABS.find(tab => tab.id === effectiveActiveTab)?.label ?? ''}
            </span>
            <nav className="flex flex-1 min-w-0 gap-1" aria-label="Outputs sections">
              {OUTPUT_TABS.map(tab => {
                // Round-3 UX correction: clicking Olumi always docks (closes
                // floating), so the tab no longer needs the "Olumi is open"
                // signage that round 2 added. Text-only label keeps Olumi
                // visually consistent with Analysis / Compare / Model.
                return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  data-testid={tab.id === 'diagnostics' ? 'outputs-dock-tab-diagnostics' : tab.id === 'olumi' ? 'outputs-dock-tab-olumi' : undefined}
                  className={`flex-1 px-2 py-1 rounded ${typography.caption} font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ${
                    effectiveActiveTab === tab.id
                      ? 'text-info border-b-2 border-info'
                      : 'text-text-header hover:bg-panel border-b-2 border-transparent'
                  }`}
                  style={
                    effectiveActiveTab === tab.id
                      ? { backgroundColor: 'color-mix(in srgb, var(--info) 15%, transparent)' }
                      : undefined
                  }
                >
                  <span className={`inline-flex items-center gap-1${tab.id === 'results' && resultsTabReallyStale ? ' text-warning' : ''}`}>
                    {tab.label}
                    {tab.id === 'results' && showResultsTabFreshnessIcon && (
                      resultsTabReallyStale ? (
                        <AlertTriangle
                          className="w-3 h-3 text-warning"
                          aria-label="Analysis is stale"
                          data-testid="results-tab-stale-icon"
                        />
                      ) : (
                        <HelpCircle
                          className="w-3 h-3 text-text-light"
                          aria-label="Cannot confirm whether this analysis is current."
                          data-testid="results-tab-cannot-confirm-icon"
                        />
                      )
                    )}
                    {tab.id === 'diagnostics' && factorsToVerify > 0 && (
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-warning text-text-on-color font-semibold"
                        style={{ fontSize: 11, fontWeight: 600, minWidth: 16, height: 16, padding: '0 4px' }}
                        title={`${factorsToVerify} factor${factorsToVerify !== 1 ? 's' : ''} to verify`}
                        data-testid="model-tab-verify-badge"
                      >
                        {factorsToVerify}
                      </span>
                    )}
                  </span>
                </button>
              )})}
            </nav>
            <button
              type="button"
              onClick={() => setExpertMode(prev => !prev)}
              className={`${typography.panelMeta} px-2 py-0.5 rounded-full border shrink-0 cursor-pointer transition-colors ${
                expertMode
                  ? 'text-info border-info'
                  : 'text-text-light border-panel-border hover:border-info hover:text-info'
              }`}
              aria-label={expertMode ? 'Disable expert mode' : 'Enable expert mode'}
              aria-pressed={expertMode}
              title="Toggle expert mode"
            >
              {'</>'}
            </button>
            <button
              type="button"
              onClick={toggleOpen}
              className={`inline-flex items-center justify-center w-6 h-6 rounded border border-panel-border ${typography.caption} text-text-header hover:bg-panel`}
              aria-label={effectiveIsOpen ? 'Collapse outputs dock' : 'Expand outputs dock'}
            >
              {effectiveIsOpen ? '>' : '<'}
            </button>
          </div>
        )}
      </div>

      {!effectiveIsOpen && (
        <nav
          className="flex flex-col items-center gap-2 py-3"
          aria-label="Outputs sections"
        >
          {OUTPUT_TABS.map(tab => {
            const Icon =
              tab.id === 'results'
                ? BarChart3
                : tab.id === 'altview'
                ? FlaskConical
                : tab.id === 'compare'
                ? Shuffle
                : tab.id === 'journey'
                ? Clock
                : tab.id === 'olumi'
                ? MessageSquare
                : Activity
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center justify-center w-7 h-7 rounded-full border ${typography.caption} focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ${
                  effectiveActiveTab === tab.id
                    ? 'text-info border-info'
                    : 'text-text-header bg-panel border-panel-border hover:bg-panel'
                }`}
                style={effectiveActiveTab === tab.id ? { backgroundColor: 'color-mix(in srgb, var(--info) 15%, transparent)' } : undefined}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )
          })}
        </nav>
      )}

      {effectiveIsOpen && (
        <div className={`flex-1 min-h-0 ${typography.caption} text-text-header ${effectiveActiveTab === 'results' || effectiveActiveTab === 'olumi' ? 'flex flex-col overflow-hidden' : 'olumi-scrollbar px-3 py-3 space-y-4 overflow-y-auto'}`} data-testid="outputs-dock-body">
            {effectiveActiveTab === 'results' && (
              <div className="flex-1 min-h-0 flex flex-col">
                {aiPanelV2On && transitionReceipt === 'model-drafted' ? (
                  <div
                    className="px-3 py-2 border-b border-panel-border"
                    role="status"
                    aria-live="polite"
                    data-testid="ai-panel-transition-receipt"
                  >
                    <span className={typo('panelMeta', 'text-info')}>Model drafted. Review readiness.</span>
                  </div>
                ) : null}
                <div className={`flex-1 min-h-0 ${isPreRun && nodes.length > 0 ? 'flex flex-col' : 'olumi-scrollbar overflow-y-auto px-3 py-3 space-y-6'}`}>
                {/* P0.6: User-friendly error display */}
                {isError && error && (() => {
                  // Coached recovery branch: when the failure is specifically about
                  // options missing intervention mappings, the system already knows
                  // which options need attention. Render names + a configure CTA
                  // instead of a generic "something went wrong" banner. Warning
                  // palette (amber), not error red — this is a known modelling
                  // state, not a system fault.
                  const isInterventionRecovery =
                    (error.code === 'EMPTY_INTERVENTIONS' ||
                      error.code === 'MISSING_INTERVENTIONS') &&
                    Boolean(error.affectedOptions && error.affectedOptions.length > 0)

                  if (isInterventionRecovery) {
                    const affected = error.affectedOptions!
                    const headline = 'Options need their effects mapped'
                    const verb = affected.length === 1 ? "doesn't" : "don't"
                    const tail = ` ${verb} have clear effects on the model's factors yet. Map how each option changes the factors it influences.`
                    const primaryLabel = `Configure ${affected[0].label}`

                    const openOptionInInspector = (optionId: string) => {
                      try {
                        useCanvasStore.getState().selectNodeWithoutHistory(optionId)
                      } catch {
                        /* non-critical: focus is best-effort */
                      }
                      focusExistingTarget(optionId, 'option')
                    }

                    return (
                      <div
                        className="flex flex-col gap-2 px-3 py-3 rounded-lg border bg-panel border-warning/30"
                        role="alert"
                        aria-live="polite"
                        data-testid="outputs-error-banner"
                        data-error-code={error.code}
                      >
                        <div className={`${typography.panelHeader} text-warning`}>
                          {headline}
                        </div>
                        <div className={`${typography.panelBody} text-text-body`}>
                          {affected.map((opt, idx) => {
                            // Inline list separator: "A and B" for two; "A, B, and C" for three+
                            let separator = ''
                            if (idx > 0) {
                              if (affected.length === 2) separator = ' and '
                              else if (idx === affected.length - 1) separator = ', and '
                              else separator = ', '
                            }
                            return (
                              <span key={opt.id}>
                                {separator}
                                <button
                                  type="button"
                                  onClick={() => openOptionInInspector(opt.id)}
                                  className="underline text-warning hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning rounded"
                                  data-testid={`coached-option-${opt.id}`}
                                >
                                  {opt.label}
                                </button>
                              </span>
                            )
                          })}
                          <span>{tail}</span>
                        </div>
                        <div className="flex flex-col gap-2 mt-1">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openOptionInInspector(affected[0].id)}
                              className={`${typography.caption} font-medium px-3 py-1.5 rounded bg-primary text-text-on-color hover:opacity-90`}
                              data-testid="coached-primary-configure"
                            >
                              {primaryLabel}
                            </button>
                            <button
                              type="button"
                              onClick={handleRunAnalysis}
                              disabled={isRunning}
                              className={`${typography.caption} font-medium px-3 py-1.5 rounded border border-warning/30 text-text-body bg-transparent hover:bg-panel disabled:opacity-50`}
                              data-testid="coached-secondary-retry"
                            >
                              Retry analysis
                            </button>
                            <button
                              type="button"
                              onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
                              className={`${typography.caption} text-text-light hover:text-text-body underline`}
                              data-testid="coached-tertiary-edit"
                            >
                              Edit model
                            </button>
                          </div>
                        </div>
                        {import.meta.env.DEV && (
                          <details className="mt-2">
                            <summary className={`${typography.code} text-text-light cursor-pointer`}>
                              Debug info
                            </summary>
                            <div className={`${typography.code} text-text-light mt-1 text-xs`}>
                              Code: {error.code} | Request ID: {error.request_id || 'n/a'}
                            </div>
                          </details>
                        )}
                      </div>
                    )
                  }

                  const friendlyError = getUserFriendlyError({
                    code: error.code,
                    message: error.message,
                    hasPartialResults: Boolean(report),
                  })

                  // Task P.3.4: CEE timeout with complexity context (>15 nodes)
                  const isCeeTimeout = error.code === 'CEE_TIMEOUT' || error.code === 'TIMEOUT'
                  const isComplexGraph = nodes.length > 15
                  if (isCeeTimeout && isComplexGraph) {
                    friendlyError.explanation = 'Your decision has many factors. Try simplifying to the 8-10 most important ones, then add detail after your first analysis.'
                  }

                  return (
                    <div
                      className={`flex flex-col gap-2 px-3 py-3 rounded-lg border ${
                        friendlyError.severity === 'error'
                          ? 'bg-panel border-danger/30'
                          : friendlyError.severity === 'warning'
                            ? 'bg-panel border-warning/30'
                            : 'bg-panel border-info/30'
                      }`}
                      role="alert"
                      aria-live="polite"
                      data-testid="outputs-error-banner"
                    >
                      <div className={`${typography.body} font-medium ${
                        friendlyError.severity === 'error'
                          ? 'text-danger'
                          : friendlyError.severity === 'warning'
                            ? 'text-warning'
                            : 'text-info'
                      }`}>
                        {friendlyError.headline}
                      </div>
                      <div className={`${typography.caption} text-text-header`}>
                        {friendlyError.explanation}
                      </div>
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex gap-2">
                          {friendlyError.canRetry && (
                            <button
                              type="button"
                              onClick={handleRunAnalysis}
                              disabled={isRunning}
                              className={`${typography.caption} font-medium px-3 py-1.5 rounded ${
                                friendlyError.severity === 'error'
                                  ? 'bg-danger-600 text-text-on-color hover:bg-danger-700'
                                  : friendlyError.severity === 'warning'
                                    ? 'bg-warning text-text-on-color hover:bg-warning-hover'
                                    : 'bg-info text-text-on-color hover:bg-info-hover'
                              } disabled:opacity-50`}
                            >
                              {friendlyError.actionText}
                            </button>
                          )}
                          {/* Task P.3.5: Edit model button (secondary action) */}
                          <button
                            type="button"
                            onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
                            className={`${typography.caption} font-medium px-3 py-1.5 rounded border ${
                              friendlyError.severity === 'error'
                                ? 'border-danger/30 text-danger hover:bg-danger-light'
                                : friendlyError.severity === 'warning'
                                  ? 'border-warning/30 text-warning hover:bg-warning-light'
                                  : 'border-info/30 text-info hover:bg-info-light'
                            }`}
                            data-testid="edit-model-button"
                          >
                            Edit model
                          </button>
                          {friendlyError.secondaryActionText && (
                            <button
                              type="button"
                              onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
                              className={`${typography.caption} font-medium px-3 py-1.5 rounded border ${
                                friendlyError.severity === 'error'
                                  ? 'border-danger/30 text-danger hover:opacity-80'
                                  : friendlyError.severity === 'warning'
                                    ? 'border-warning/30 text-warning hover:opacity-80'
                                    : 'border-info/30 text-info hover:opacity-80'
                              }`}
                              data-testid="error-secondary-action"
                            >
                              {friendlyError.secondaryActionText}
                            </button>
                          )}
                        </div>
                        {/* Task P.3.5: Coaching text for repeated failures */}
                        <p className={`${typography.caption} text-text-header`}>
                          If analysis keeps failing, try simplifying to 8-10 of the most important factors.
                        </p>
                      </div>
                      {/* Debug info (only in dev mode) */}
                      {import.meta.env.DEV && (
                        <details className="mt-2">
                          <summary className={`${typography.code} text-text-light cursor-pointer`}>
                            Debug info
                          </summary>
                          <div className={`${typography.code} text-text-light mt-1 text-xs`}>
                            Code: {error.code} | Request ID: {error.request_id || 'n/a'}
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })()}
                {/* v7: Rerun + Compare buttons moved to sticky footer below */}
                {/* Pre-run state: Show consolidated guidance and Run button */}
                {isPreRun && nodes.length > 0 && (
                  isPreAnalysisV3Enabled() ? (
                    /* Pre-analysis panel v3 (flag preAnalysisV3): outcome-centred
                       panel, lazy-loaded so flag-off users pay no bundle cost.
                       Reinstatement: flag off restores the legacy branch below,
                       byte-identical. See docs/pre-analysis-panel-solution-design-v1.md §14. */
                    <div className="flex-1 min-h-0 flex flex-col" data-testid="outputs-pre-run-v3">
                      <Suspense fallback={null}>
                        <PreAnalysisPanelV3
                          onAnalyse={handleRunAnalysis}
                          isAnalysing={isRunning}
                          canRun={canRunAnalysis}
                          blockedReason={runBlockedTooltip}
                        />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 flex flex-col" data-testid="outputs-pre-run">
                      {/* Pre-Analysis Panel - M1 rebuild with new component architecture */}
                      {/* Goal node selector and threshold are now inside AnalysisSettings accordion */}
                      <PreAnalysisPanel
                        onAnalyse={handleRunAnalysis}
                        isAnalysing={isRunning}
                        blockedReason={runBlockedTooltip}
                        onSendMessage={sendMessage}
                        expertMode={expertMode}
                      />
                    </div>
                  )
                )}
                {/* 1.16i + first-five-minutes: visible staged processing for
                    the WHOLE analysis turn, on every run. It renders above
                    the retained report when there is one and above the
                    results skeleton when there is not — a first run is no
                    longer silent for its first 20 seconds. The skeleton
                    below is decorative so this stays the one live region. */}
                {runStatus === 'banner' && <AnalysisRunningBanner startedAt={resultsStartedAt} />}
                {/* I.2b: Cancel button during active analysis — gated on the
                    V2 hook's own in-flight flag (1.16i): cancelRun only
                    aborts the V2 request, so it must not render for a V5
                    analysing turn. */}
                {isV2RunInFlight && (
                  <div className="flex justify-end px-3">
                    <button
                      type="button"
                      onClick={cancelRun}
                      className={`${typography.caption} font-medium px-3 py-1.5 rounded border border-panel-border text-text-body hover:bg-panel-hover flex items-center gap-1.5`}
                      data-testid="cancel-analysis-button"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Cancel
                    </button>
                  </div>
                )}
                {/* P0.7: Loading skeleton during analysis (when streaming without report) */}
                {isRunning && !report && (
                  <ResultsPanelSkeleton />
                )}
                {/* P0 Engine: Identifiability Badge - only show when we have a meaningful status */}
                {(() => {
                  // Safely normalize backend identifiability tag to prevent runtime errors
                  const normalizedStatus = !isPreRun
                    ? normalizeIdentifiabilityTag(report?.model_card?.identifiability_tag)
                    : null
                  // Don't show badge for 'unknown' status - it just says "Run analysis to calculate"
                  return normalizedStatus && normalizedStatus !== 'unknown' && (
                    <IdentifiabilityBadge status={normalizedStatus} />
                  )
                })()}
                {/* NOTE: UnifiedStatusBadge removed - TrustSignal now provides plain-language
                    reliability assessment. Keeping import for potential future use in Compare tab. */}
                {/* v1.1 Contract: Engine critique shown post-run only if blockers exist
                    Note: Pre-run validation uses graphHealth, post-run uses engine critique
                    Only show if engine detected blockers that prevented clean results.

                    ⛔ ROADMAP 2.651 — Paul's Ruling 3. The `!analysisNotConfirmedFresh`
                    limb of this gate is RETIRED. RCA-C/F18 freshness-gated the render
                    because an engine critique bakes the run-time limit into its free text
                    ("Graph too large: 16 nodes (limit: 12)"), which a newer live limit
                    could contradict. That is an argument about what the display CLAIMS,
                    and the tab already answers it — AnalysisFreshnessNotice states "Model
                    changed since this analysis. Re-run to update." directly above. Hiding
                    it also hid ValidationPanel's Auto-fix, a graph MUTATION affordance,
                    from the user's first edit onward. Staleness is a property of RESULTS,
                    never a lock: out-of-date results are labelled, not withheld — the same
                    doctrine the wrapper below already records ("v6 keeps stale results
                    fully readable … No dimming, no aria-disabled lockout"). Live
                    graphHealth still speaks in parallel; it is no longer made to speak
                    INSTEAD. `!isPreRun` and the BLOCKER filter are untouched — both are
                    pinned in `OutputsDock.staleEngineCritique.spec.tsx`. */}
                {!isPreRun && report?.run?.critique && report.run.critique.some(c => c.severity === 'BLOCKER') && (
                  <div data-testid="outputs-engine-critique">
                    <ValidationPanel
                      critique={mapCritiqueToValidation(report.run.critique)}
                      onAutoFix={handleAutoFix}
                    />
                  </div>
                )}
                {/* Phase 2: Response warnings banner (edge type inferred, weights normalized, etc.) */}
                {!isPreRun && !warningsDismissed && report?.warnings && report.warnings.length > 0 && (
                  <WarningBanner
                    warnings={report.warnings
                      .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
                      .map((msg) => ({ code: 'GENERAL', message: msg }))}
                    onDismiss={() => setWarningsDismissed(true)}
                    onViewAffected={(ids) => {
                      setHighlightedNodes(ids)
                      setTimeout(() => setHighlightedNodes([]), 3000)
                    }}
                  />
                )}
                {/* P2: Degraded/partial state banner */}
                {!isPreRun && !degradedBannerDismissed && (ceeDegraded || (
                  resultsSectionData?.drivers?.driversStatus &&
                  resultsSectionData.drivers.driversStatus !== 'computed'
                ) || (
                  resultsSectionData?.confidence?.robustnessStatus &&
                  resultsSectionData.confidence.robustnessStatus !== 'computed'
                )) && (
                  <DegradedStateBanner
                    ceeDegraded={ceeDegraded}
                    ceeTimeoutReason={ceeDegraded ? 'Model review may be incomplete.' : undefined}
                    islPartial={
                      (resultsSectionData?.drivers?.driversStatus !== 'computed') ||
                      (resultsSectionData?.confidence?.robustnessStatus !== 'computed' &&
                       resultsSectionData?.confidence?.robustnessStatus !== undefined)
                    }
                    analysisTypes={[
                      {
                        name: 'Comparison',
                        available: resultsSectionData?.recommendation?.analysisStatus === 'computed',
                      },
                      {
                        name: 'Drivers',
                        available: resultsSectionData?.drivers?.driversStatus === 'computed',
                      },
                      {
                        name: 'Robustness',
                        available: resultsSectionData?.confidence?.robustnessStatus === 'computed',
                      },
                    ].filter(() => resultsSectionData != null)}
                    onDismiss={() => setDegradedBannerDismissed(true)}
                  />
                )}
                {/* I.2c: Stale results indicator — shown when current run errored
                    but previous results are still visible */}
                {isError && report && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-panel border border-warning/30 rounded"
                    role="status"
                    data-testid="stale-results-banner"
                  >
                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" aria-hidden="true" />
                    <span className={`${typography.caption} text-text-header`}>
                      Showing results from previous analysis
                    </span>
                  </div>
                )}
                {/* Wave F-B (brief §5.2): the top-level stale banner is RETIRED —
                    AnalysisFreshnessNotice (mounted below in this tab's
                    scroller, above the results body) is the sole freshness
                    owner and carries the one Rerun. The 0.6 dim on the
                    results body (below) stays, driven by the same canonical
                    verdict. */}
                {/* A.9: Conversation-triggered analysis indicator — auto-dismisses after 5s */}
                {convIndicatorVisible && !isPreRun && report && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5"
                    role="status"
                    aria-live="polite"
                    data-testid="conv-results-indicator"
                    onClick={() => setConvIndicatorVisible(false)}
                  >
                    <MessageCircle className="w-3 h-3 text-text-light flex-shrink-0" aria-hidden="true" />
                    <span className={`${typography.caption} text-text-light`}>
                      Updated from conversation
                    </span>
                  </div>
                )}
                {/* ======================================================================
                    Results Panel v7: Four-Section Flat Layout
                    Sections: 1. Hero  2. Options comparison  3. Drivers  4. Strengthen
                    18px gaps between sections, no accordion wrappers on Drivers.
                    Legacy blocks (InsightsPanel, AdvancedSettings, variance warning) removed
                    from Results tab — they are not in the v7 prototype.
                    ====================================================================== */}
                {/* Wave 1: Decision overview — the orientation surface, first
                    in the canonical hierarchy (brief §3). Mount-site gated
                    (house pattern, review B1): flag-off renders NOTHING and
                    pays no subscription or parsing cost. */}
                {isDecisionOverviewEnabled() && !isPreRun && hasInlineSummary && resultsSectionData && (
                  <DecisionOverviewCard title={overviewTitle} />
                )}
                {/* The freshness strip states fresh/stale/unknown (informational
                    only — the anchor footer below owns the Rerun). It mounts
                    ABOVE the dim wrapper at full opacity so the freshness signal
                    never sits inside an aria-disabled region. */}
                {!isPreRun && hasInlineSummary && resultsSectionData && (
                  <AnalysisFreshnessNotice />
                )}
                {!isPreRun && hasInlineSummary && resultsSectionData && (
                  <div
                    // Parity audit: v6 keeps stale results fully readable —
                    // the freshness strip above carries the warning and the
                    // recovery action. No dimming, no aria-disabled lockout;
                    // data-freshness-confirmed preserves the signal for tests.
                    // Lane 3 review fold: the historical `!isError` escape
                    // existed for banner mutual-exclusion when the body only
                    // mounted at 'complete'; with the body now mounted at
                    // 'error' it stamped confirmed='true' over an unconfirmed
                    // display (a false test/debug signal) and unlocked
                    // mutations below.
                    data-freshness-confirmed={analysisNotConfirmedFresh ? 'false' : 'true'}
                    data-testid="results-body-stale-wrapper"
                    // Lane 3 (SF2): run-in-flight is MARKED, not blanked —
                    // v6 doctrine (content stays readable, no dim/lockout).
                    aria-busy={isRunning || undefined}
                    data-run-status={resultsStatus}
                  >
                  <ResultsBody
                    resultsSectionData={resultsSectionData}
                    tornadoData={tornadoData}
                    highlightedDriverId={highlightedDriverId}
                    registerDriverRef={registerDriverRef}
                    strengthCorrections={strengthCorrectionsForRun}
                    onFocusNode={handleFocusResultNode}
                    isRunning={isRunning}
                    onApplyThreshold={handleApplyThreshold}
                    nSamples={(report as any)?.summary?.n_samples_used ?? (report as any)?.meta?.n_samples}
                    seedUsed={(report as any)?.meta?.seed}
                    fragileEdgeCount={(report as any)?.robustness?.fragile_edges?.length}
                    robustEdgeCount={(report as any)?.robustness?.robust_edges?.length}
                    responseHash={results?.hash}
                    nodeCount={nodes.length}
                    edgeCount={edges.length}
                    identifiability={report?.model_card?.identifiability_tag}
                    goalDirection={goalDirection}
                    onActivateGuidanceItem={setActiveGuidanceItem}
                    verifiedCount={transitionBridgeRef.current.verifiedCount}
                    influenceCoverage={transitionBridgeRef.current.influenceCoverage}
                    driversExpanded={driversExpanded}
                    onDriversExpandChange={setDriversExpanded}
                    onSendMessage={sendMessage}
                    onConfirmFactor={handleTriageConfirm}
                    onSetFactorValue={handleTriageSetValue}
                    expertMode={expertMode}
                    nodeValueLookup={nodeValueLookup}
                    // ⛔ ROADMAP 2.651 — Paul's Ruling 3. This value NO LONGER
                    // GATES ANY AFFORDANCE. `ResultsBody`'s suppression is now
                    // `isRunning` alone; staleness is carried by the display
                    // (`AnalysisFreshnessNotice`, and `data-freshness-confirmed`
                    // on the wrapper above), never by withholding a control.
                    // The prop is kept so this derivation stays visible at the
                    // seam — re-attaching a lock to it must be a visible diff.
                    // (The historical Lane 3 note about the `!isError` escape
                    // "re-enabling factor mutations against a not-fresh display"
                    // described the retired Brief 4 Task 13 gate and no longer
                    // applies: mutations are correct on a not-fresh display.)
                    isStale={analysisNotConfirmedFresh}
                  />
                  </div>
                )}
                </div>
                {/* Brief 5.4 Phase 11: "Create decision brief" placeholder removed.
                    Anchor-run-control (Paul, 21-Jul): the sticky bottom anchor
                    is the SOLE Rerun owner. It shows the robustness verdict AND
                    the Rerun action ALONGSIDE each other — never the verdict in
                    place of the run control (Paul's finding: "the bottom anchor
                    shows the verdict in the slot where the run-analysis control
                    should be"). The footer is the tab's most reliable
                    always-visible owner — it sits OUTSIDE the scroller, so it
                    can never scroll away. The freshness strip above keeps
                    stating fresh/stale/unknown but no longer carries a Rerun, so
                    there is exactly one Rerun and no duplicate. See the
                    orphan-banner note above for why nothing else may suppress
                    this footer. */}
                {!isPreRun && hasInlineSummary && resultsSectionData && (
                  <AnalysisFooter
                    statusIcon={postRunFooter.icon}
                    statusIconClassName={postRunFooter.iconClass}
                    statusText={postRunFooter.label}
                    metaText={postRunMetaText}
                    metaPlacement="stacked"
                    actionLabel={isRunning ? 'Running analysis…' : 'Rerun'}
                    actionVariant="secondary"
                    onAction={handleRunAnalysis}
                    actionDisabled={isRunning || !canRunAnalysis}
                    actionLoading={isRunning}
                    actionTitle={!canRunAnalysis && !isRunning ? runBlockedTooltip : undefined}
                    testId="results-analysis-footer"
                  />
                )}
              </div>
            )}
            {effectiveActiveTab === 'altview' && (
              // TEMPORARY comparison tab (12 Aug 2026): the V7 assessment
              // group, moved off the Analysis tab. SINGLE DATA AUTHORITY:
              // the SAME resultsSectionData instance + the SAME
              // fragile/robust edge-count expressions ResultsBody receives
              // above — never a re-derivation.
              <V7ComparisonTabBody
                resultsSectionData={resultsSectionData}
                fragileEdgeCount={(report as any)?.robustness?.fragile_edges?.length}
                robustEdgeCount={(report as any)?.robustness?.robust_edges?.length}
                onFocusNode={handleFocusResultNode}
                onSendMessage={sendMessage}
              />
            )}
            {effectiveActiveTab === 'compare' && (
              // 2.581 — ONE expert mode for the product. The Compare pill used
              // to own a separate `feature.compareExpert` state, so the only
              // control in the UI whose visible text says "Expert" turned on a
              // different thing from the `</>` toggle beside it — the measured
              // cause of the "downside tail is scenario-dependent" report.
              <CompareTabBodyV2
                onRunAnalysis={handleRunAnalysis}
                expertMode={expertMode}
                onToggleExpert={setExpertMode}
              />
            )}
            {effectiveActiveTab === 'diagnostics' && (
              <ModelTabBody
                showDebug={showDebug}
                hasDiagnostics={hasDiagnostics}
                diagnostics={diagnostics}
                hasTrim={hasTrim}
                effectiveCorrelationId={effectiveCorrelationId}
                correlationMismatch={correlationMismatch}
                correlationIdHeader={correlationIdHeader}
                nodes={nodes}
                edges={edges}
                robustness={mappedRobustness}
                factorInfluence={factorInfluenceMap}
                onReanalyse={handleRunAnalysis}
                ceeQuality={ceeQuality}
                expertMode={expertMode}
                onSendMessage={sendMessage}
              />
            )}
            {effectiveActiveTab === 'journey' && (
              <JourneyTabBody />
            )}
            {/* Olumi: keep mounted across tab switches so ChatThread's scroll
                position and useSmartScroll state survive. Visibility toggled
                with CSS so the underlying ChatThread never unmounts when the
                user switches to Compare/Model/etc.
                Uses `effectiveActiveTab` so the wrapper stays `hidden` on
                the very first paint when persisted state had activeTab='olumi'
                + floating already open. */}
            {aiPanelV2On && (
              <div
                className={`flex flex-1 min-h-0 flex-col ${effectiveActiveTab === 'olumi' ? '' : 'hidden'}`}
                data-testid="olumi-tab-wrapper"
                aria-hidden={effectiveActiveTab !== 'olumi'}
              >
                <OlumiTabBody onFloatOut={floatOutToWindow} />
              </div>
            )}
          </div>
        )}

        {/* aiPanelV2 footer stack: selection pill + stale badge + persistent
            input strip + cog popover. Always visible at panel base when
            flag is on and the dock is expanded. flex-shrink-0 prevents the
            body's overflow from clipping these. */}
        {aiPanelV2On && effectiveIsOpen ? (
          <div className="flex-shrink-0" data-testid="ai-panel-footer-stack">
            <SelectionPill />
            {/* Wave F-B: StaleAnalysisBadge retired — third stale surface in
                one dock, and its rerun bypassed the canonical runner. The
                freshness strip owns stale + Rerun. */}
            <PersistentInputStrip
              isOlumiTabActive={effectiveActiveTab === 'olumi'}
              onOpenFloating={floatOutToWindow}
              onFocusFloating={focusFloating}
              onCogClick={handleCogClick}
            />
            <CogPopover
              isOpen={cogAnchor !== null}
              anchorEl={cogAnchor}
              onClose={handleCogClose}
            />
          </div>
        ) : null}

        {/* M6: Scenario Comparison - Modal removed, now rendered as ComparisonCanvasLayout in ReactFlowGraph */}

        {/* M6: Loading overlay during comparison */}
        {scenarioComparison.loading && (
          <div
            className="fixed inset-0 z-[1000] bg-black/30 flex items-center justify-center"
            role="progressbar"
            aria-label="Generating scenario comparison"
            data-testid="scenario-comparison-loading"
          >
            <div className="bg-white px-6 py-4 rounded-lg shadow-3 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-info border-t-transparent rounded-full animate-spin" />
              <span className={`${typography.body} text-text-header`}>Generating comparison...</span>
            </div>
          </div>
        )}

        {/* M6: Error display for comparison */}
        {scenarioComparison.error && (
          <div
            className="fixed bottom-24 right-4 z-[1000] bg-panel border border-danger/30 px-4 py-3 rounded-lg shadow-3 max-w-sm"
            role="alert"
            data-testid="scenario-comparison-error"
          >
            <div className={`${typography.bodySmall} font-medium text-danger-800`}>
              Comparison failed
            </div>
            <p className={`${typography.caption} text-danger-700 mt-1`}>
              {scenarioComparison.error}
            </p>
            <button
              type="button"
              onClick={scenarioComparison.clearComparison}
              className={`mt-2 ${typography.caption} text-danger-600 hover:text-danger-800 underline`}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Legacy v7 sticky footer removed — superseded by AnalysisFooter above */}
    </aside>
    </>
  )
}
