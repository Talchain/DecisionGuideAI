// src/flags.ts
// ============================================================================
// UI/EXPERIMENT FEATURE FLAGS
// ============================================================================
//
// PURPOSE: Controls UI features, experiments, and A/B tests that can be
// toggled per-user or per-session. These flags affect what users see.
//
// SOURCES: Environment variables (VITE_FEATURE_*) + localStorage overrides
//
// EXAMPLES:
//   - isCompareEnabled()      → Show compare feature
//   - isScenariosEnabled()    → Enable scenario management
//   - isGraphLensEnabled       → Show graph lens modes
//
// DO NOT USE FOR:
//   - Environment detection (dev/prod/E2E) → use lib/featureFlags.ts
//   - Service base URLs → use lib/featureFlags.ts
//   - Analytics/Sentry toggles → use lib/featureFlags.ts
//
// See also: src/lib/featureFlags.ts for infrastructure/environment flags
// ============================================================================

import { makeFlag, diagnoseFlagState } from './lib/flagFactory'

// ============================================================================
// FLAG CONFIGURATIONS (centralized, type-safe)
// ============================================================================

const FLAGS_CONFIG = {
  sseStreaming: {
    envKey: 'VITE_FEATURE_SSE',
    storageKey: 'feature.sseStreaming',
  },
  summaryV2: {
    envKey: 'VITE_FEATURE_SUMMARY_V2',
    storageKey: 'feature.summaryV2',
  },
  guidedV1: {
    envKey: 'VITE_FEATURE_GUIDED_V1',
    storageKey: 'feature.guidedV1',
  },
  comments: {
    envKey: 'VITE_FEATURE_COMMENTS',
    storageKey: 'feature.comments',
  },
  snapshots: {
    envKey: 'VITE_FEATURE_SNAPSHOTS',
    storageKey: 'feature.snapshots',
  },
  compare: {
    envKey: 'VITE_FEATURE_COMPARE',
    storageKey: 'feature.compare',
  },
  scorecard: {
    envKey: 'VITE_FEATURE_SCORECARD',
    storageKey: 'feature.scorecard',
  },
  diagnostics: {
    envKey: 'VITE_FEATURE_DIAGNOSTICS',
    storageKey: 'feature.diagnostics',
    defaultValue: true,
  },
  perfProbes: {
    envKey: 'VITE_FEATURE_PERF_PROBES',
    storageKey: 'feature.perfProbes',
  },
  canvasSimplify: {
    envKey: 'VITE_FEATURE_CANVAS_SIMPLIFY',
    storageKey: 'feature.canvasSimplify',
  },
  listView: {
    envKey: 'VITE_FEATURE_LIST_VIEW',
    storageKey: 'feature.listView',
  },
  engineMode: {
    envKey: 'VITE_FEATURE_ENGINE_MODE',
    storageKey: 'feature.engineMode',
  },
  mobileGuardrails: {
    envKey: 'VITE_FEATURE_MOBILE_GUARDRAILS',
    storageKey: 'feature.mobileGuardrails',
  },
  configDrawer: {
    envKey: 'VITE_FEATURE_CONFIG_DRAWER',
    storageKey: 'feature.configDrawer',
  },
  e2e: {
    envKey: 'VITE_E2E',
    storageKey: 'e2e.enabled',
  },
  realReport: {
    envKey: 'VITE_FEATURE_REAL_REPORT',
    storageKey: 'feature.realReport',
  },
  telemetry: {
    envKey: 'VITE_FEATURE_TELEMETRY',
    storageKey: 'feature.telemetry',
  },
  ghost: {
    envKey: 'VITE_FEATURE_GHOST_PANEL',
    storageKey: 'feature.ghostPanel',
  },
  jobsProgress: {
    envKey: 'VITE_FEATURE_JOBS_PROGRESS',
    storageKey: 'feature.jobsProgress',
  },
  errorBanners: {
    envKey: 'VITE_FEATURE_ERROR_BANNERS',
    storageKey: 'feature.errorBanners',
  },
  runReport: {
    envKey: 'VITE_FEATURE_RUN_REPORT',
    storageKey: 'feature.runReport',
  },
  hints: {
    envKey: 'VITE_FEATURE_HINTS',
    storageKey: 'feature.hints',
  },
  params: {
    envKey: 'VITE_FEATURE_PARAMS',
    storageKey: 'feature.params',
  },
  history: {
    envKey: 'VITE_FEATURE_HISTORY',
    storageKey: 'feature.history',
  },
  export: {
    envKey: 'VITE_FEATURE_EXPORT',
    storageKey: 'feature.export',
  },
  replay: {
    envKey: 'VITE_FEATURE_REPLAY',
    storageKey: 'feature.replay',
  },
  historyRerun: {
    envKey: 'VITE_FEATURE_HISTORY_RERUN',
    storageKey: 'feature.historyRerun',
  },
  markdownPreview: {
    envKey: 'VITE_FEATURE_MD_PREVIEW',
    storageKey: 'feature.mdPreview',
  },
  shortcuts: {
    envKey: 'VITE_FEATURE_SHORTCUTS',
    storageKey: 'feature.shortcuts',
  },
  copyCode: {
    envKey: 'VITE_FEATURE_COPY_CODE',
    storageKey: 'feature.copyCode',
  },
  canvas: {
    envKey: 'VITE_FEATURE_CANVAS',
    storageKey: 'feature.canvas',
  },
  canvasDefault: {
    envKey: 'VITE_FEATURE_CANVAS_DEFAULT',
    storageKey: 'feature.canvasDefault',
  },
  tldraw: {
    envKey: 'VITE_FEATURE_TLDRAW',
    storageKey: 'feature.tldraw',
  },
  scenarios: {
    envKey: 'VITE_FEATURE_SCENARIOS',
    storageKey: 'feature.scenarios',
  },
  scenarioImportPreview: {
    envKey: 'VITE_FEATURE_SCENARIO_IMPORT_PREVIEW',
    storageKey: 'feature.scenarioImportPreview',
  },
  debug: {
    envKey: 'VITE_FEATURE_DEBUG',
    storageKey: 'feature.debug',
  },
  snapshotsV2: {
    envKey: 'VITE_FEATURE_SNAPSHOTS_V2',
    storageKey: 'feature.snapshotsV2',
  },
  onboardingTour: {
    envKey: 'VITE_FEATURE_ONBOARDING',
    storageKey: 'feature.onboardingTour',
  },
  // Brief v2.2: Decision Model Schema v2.2 support
  // When enabled, UI requests ?schema=v2 from CEE and handles:
  // - observed_state on factor nodes
  // - effect_direction + strength_std on edges
  // - Signed strength.mean in ISL requests
  schemaV2: {
    envKey: 'VITE_FEATURE_SCHEMA_V2',
    storageKey: 'feature.schemaV2',
  },
  // Phase 1A: PLoT Enrichment Routing Consolidation
  // When enabled, UI consumes robustness/sensitivity data from PLoT's enrichment
  // response instead of calling ISL directly. This eliminates the dual-pipeline
  // problem where PLoT and ISL produce inconsistent results.
  // Default: false (preserve current behaviour until PLoT enrichment is ready)
  plotEnrichment: {
    envKey: 'VITE_USE_PLOT_ENRICHMENT',
    storageKey: 'feature.plotEnrichment',
  },
  // A.5+: Orchestrator V2 conversation panel
  // When ON, all DraftChat sends go through POST /orchestrate/v1/turn.
  // When OFF, existing draft-graph flow is preserved unchanged.
  orchestratorV2: {
    envKey: 'VITE_ENABLE_ORCHESTRATOR_V2',
    storageKey: 'feature.orchestratorV2',
  },
  // Transition flag: flip OFF once orchestrator path is confirmed on staging.
  // Pilot users should only get results via orchestrator.
  // When OFF and orchestratorV2 is ON: Play button triggers only the orchestrator path.
  // When ON (default): direct PLoT /v1/run call runs alongside orchestrator (for dual-path).
  legacyDirectRun: {
    envKey: 'VITE_ENABLE_LEGACY_DIRECT_RUN',
    storageKey: 'feature.legacyDirectRun',
    defaultValue: true,
  },
  // Track 1: Decision Journey tab in OutputsDock right panel
  journeyTab: {
    envKey: 'VITE_FEATURE_JOURNEY_TAB',
    storageKey: 'feature.journeyTab',
  },
  // Compare tab in OutputsDock (disabled by default — v4 removes it from tab bar)
  compareTab: {
    envKey: 'VITE_FEATURE_COMPARE_TAB',
    storageKey: 'feature.compareTab',
  },
  // Orchestrator streaming: SSE progressive rendering of turn responses
  // When ON, POST /orchestrate/v1/turn/stream is used instead of /turn.
  // Text deltas render incrementally; stores commit only on turn_complete.
  orchestratorStreaming: {
    envKey: 'VITE_FEATURE_ORCHESTRATOR_STREAMING',
    storageKey: 'feature.orchestratorStreaming',
  },
  // Track 2: Thread persistence (conversation -> Supabase)
  threadPersist: {
    envKey: 'VITE_FEATURE_THREAD_PERSIST',
    storageKey: 'feature.threadPersist',
  },
  // Track 3: Thread hydration on scenario resume + stale block revalidation
  threadHydrate: {
    envKey: 'VITE_FEATURE_THREAD_HYDRATE',
    storageKey: 'feature.threadHydrate',
  },
  // BIL: Brief Intelligence Layer local preview in ChatComposer
  // Gates only the UI preview (extract + summary line). Persistence
  // (snapshots, conversation_turns, analysis_summary wiring) runs regardless.
  bil: {
    envKey: 'VITE_FEATURE_BIL',
    storageKey: 'feature.bil',
  },
  // Phase 2B: Pre-analysis enrichment (receipt block, evidence gaps, model notes, one-click fixes)
  preAnalysisEnriched: {
    envKey: 'VITE_FEATURE_PRE_ANALYSIS_ENRICHED',
    storageKey: 'feature.preAnalysisEnriched',
  },
  // Phase 3A: Evidence gap badge on factor nodes with no observed data
  graphBadges: {
    envKey: 'VITE_FEATURE_GRAPH_BADGES',
    storageKey: 'feature.graphBadges',
  },
  // Phase 3A: Cross-surface bidirectional hover highlighting (canvas ↔ panel)
  crossHighlight: {
    envKey: 'VITE_FEATURE_CROSS_HIGHLIGHT',
    storageKey: 'feature.crossHighlight',
  },
  // Graph Lens: post-analysis canvas filtering modes (option isolation, sensitivity, fragile edges)
  graphLens: {
    envKey: 'VITE_FEATURE_GRAPH_LENS',
    storageKey: 'feature.graphLens',
  },
  // Brief A: Orchestrator rendering v2 — SafeRichText, commentary collapse, review card tone styling
  // When ON: markdown rendering, collapsible commentary, tone-driven review cards
  // When OFF: current behaviour unchanged (no contract changes)
  orchestratorRenderingV2: {
    envKey: 'VITE_FEATURE_ORCHESTRATOR_RENDERING_V2',
    storageKey: 'feature.orchestratorRenderingV2',
  },
  // Deterministic CEE: typed JSON responses, new block types, insights
  // When ON: new block renderers (comparison, premortem, flip_analysis, proposal, exercise) + insights strip
  // When OFF: new block types suppressed, insights not rendered
  deterministicCee: {
    envKey: 'VITE_FEATURE_DETERMINISTIC_CEE',
    storageKey: 'feature.deterministicCee',
  },
  // Analysis hero v17: decision-strengthening hero on the post-analysis Analysis tab.
  // When ON, AnalysisHeroV17 renders INSTEAD OF DecisionConfidencePanel at the
  // ResultsBody top-of-card render slot.
  //
  // Off-by-default for production safety (Round-5 review P1.3). To enable
  // locally for manual testing, run this once in the browser console:
  //
  //   localStorage.setItem('feature.analysisHeroV17', '1')
  //
  // For staging builds, set `VITE_FEATURE_ANALYSIS_HERO_V17=1` in the build
  // env. See docs/brief-analysis-hero-v17-implementation.md.
  analysisHeroV17: {
    envKey: 'VITE_FEATURE_ANALYSIS_HERO_V17',
    storageKey: 'feature.analysisHeroV17',
  },
  // Analysis hero v17 — opt-in comparison mode. When ON, BOTH the new hero
  // AND the existing DecisionConfidencePanel render (new hero above), for
  // internal visual review only. Never default-on. Bootable via the URL
  // param `?analysisHeroCompare=1` (and clearable with `=0`) — see the
  // boot-step in src/main.tsx.
  analysisHeroCompare: {
    envKey: 'VITE_FEATURE_ANALYSIS_HERO_COMPARE',
    storageKey: 'feature.analysisHeroCompare',
  },
  // AI panel v2 — phased rollout for the right-panel AI conversation. Step 1
  // mounts the split-layout scaffold behind the flag while leaving the
  // existing DraftChat surface live; later steps move the input/thread into
  // the panel and add Compact / Conversation / Focus modes. Default OFF.
  // See src/canvas/ai-panel-v2/ for the new components.
  aiPanelV2: {
    envKey: 'VITE_FEATURE_AI_PANEL_V2',
    storageKey: 'feature.aiPanelV2',
  },
} as const

// ============================================================================
// EXPORTED FUNCTIONS (backward compatible API)
// ============================================================================

// Generate all flag functions
const flags = {
  sseStreaming: makeFlag(FLAGS_CONFIG.sseStreaming),
  summaryV2: makeFlag(FLAGS_CONFIG.summaryV2),
  guidedV1: makeFlag(FLAGS_CONFIG.guidedV1),
  comments: makeFlag(FLAGS_CONFIG.comments),
  snapshots: makeFlag(FLAGS_CONFIG.snapshots),
  compare: makeFlag(FLAGS_CONFIG.compare),
  scorecard: makeFlag(FLAGS_CONFIG.scorecard),
  diagnostics: makeFlag(FLAGS_CONFIG.diagnostics),
  perfProbes: makeFlag(FLAGS_CONFIG.perfProbes),
  canvasSimplify: makeFlag(FLAGS_CONFIG.canvasSimplify),
  listView: makeFlag(FLAGS_CONFIG.listView),
  engineMode: makeFlag(FLAGS_CONFIG.engineMode),
  mobileGuardrails: makeFlag(FLAGS_CONFIG.mobileGuardrails),
  configDrawer: makeFlag(FLAGS_CONFIG.configDrawer),
  e2e: makeFlag(FLAGS_CONFIG.e2e),
  realReport: makeFlag(FLAGS_CONFIG.realReport),
  telemetry: makeFlag(FLAGS_CONFIG.telemetry),
  ghost: makeFlag(FLAGS_CONFIG.ghost),
  jobsProgress: makeFlag(FLAGS_CONFIG.jobsProgress),
  errorBanners: makeFlag(FLAGS_CONFIG.errorBanners),
  runReport: makeFlag(FLAGS_CONFIG.runReport),
  hints: makeFlag(FLAGS_CONFIG.hints),
  params: makeFlag(FLAGS_CONFIG.params),
  history: makeFlag(FLAGS_CONFIG.history),
  export: makeFlag(FLAGS_CONFIG.export),
  replay: makeFlag(FLAGS_CONFIG.replay),
  historyRerun: makeFlag(FLAGS_CONFIG.historyRerun),
  markdownPreview: makeFlag(FLAGS_CONFIG.markdownPreview),
  shortcuts: makeFlag(FLAGS_CONFIG.shortcuts),
  copyCode: makeFlag(FLAGS_CONFIG.copyCode),
  canvas: makeFlag(FLAGS_CONFIG.canvas),
  canvasDefault: makeFlag(FLAGS_CONFIG.canvasDefault),
  tldraw: makeFlag(FLAGS_CONFIG.tldraw),
  scenarios: makeFlag(FLAGS_CONFIG.scenarios),
  scenarioImportPreview: makeFlag(FLAGS_CONFIG.scenarioImportPreview),
  debug: makeFlag(FLAGS_CONFIG.debug),
  snapshotsV2: makeFlag(FLAGS_CONFIG.snapshotsV2),
  onboardingTour: makeFlag(FLAGS_CONFIG.onboardingTour),
  schemaV2: makeFlag(FLAGS_CONFIG.schemaV2),
  plotEnrichment: makeFlag(FLAGS_CONFIG.plotEnrichment),
  orchestratorV2: makeFlag(FLAGS_CONFIG.orchestratorV2),
  legacyDirectRun: makeFlag(FLAGS_CONFIG.legacyDirectRun),
  orchestratorStreaming: makeFlag(FLAGS_CONFIG.orchestratorStreaming),
  journeyTab: makeFlag(FLAGS_CONFIG.journeyTab),
  compareTab: makeFlag(FLAGS_CONFIG.compareTab),
  threadPersist: makeFlag(FLAGS_CONFIG.threadPersist),
  threadHydrate: makeFlag(FLAGS_CONFIG.threadHydrate),
  bil: makeFlag(FLAGS_CONFIG.bil),
  preAnalysisEnriched: makeFlag(FLAGS_CONFIG.preAnalysisEnriched),
  graphBadges: makeFlag(FLAGS_CONFIG.graphBadges),
  crossHighlight: makeFlag(FLAGS_CONFIG.crossHighlight),
  graphLens: makeFlag(FLAGS_CONFIG.graphLens),
  orchestratorRenderingV2: makeFlag(FLAGS_CONFIG.orchestratorRenderingV2),
  deterministicCee: makeFlag(FLAGS_CONFIG.deterministicCee),
  analysisHeroV17: makeFlag(FLAGS_CONFIG.analysisHeroV17),
  analysisHeroCompare: makeFlag(FLAGS_CONFIG.analysisHeroCompare),
  aiPanelV2: makeFlag(FLAGS_CONFIG.aiPanelV2),
}

// Export with original naming convention for backward compatibility
export const isSseEnabled = flags.sseStreaming
export const isSummaryV2Enabled = flags.summaryV2
export const isGuidedV1Enabled = flags.guidedV1
export const isCommentsEnabled = flags.comments
export const isSnapshotsEnabled = flags.snapshots
export const isCompareEnabled = flags.compare
export const isScorecardEnabled = flags.scorecard
export const isDiagnosticsEnabled = flags.diagnostics
export const isPerfProbesEnabled = flags.perfProbes
export const isCanvasSimplifyEnabled = flags.canvasSimplify
export const isListViewEnabled = flags.listView
export const isEngineModeEnabled = flags.engineMode
export const isMobileGuardrailsEnabled = flags.mobileGuardrails
export const isConfigDrawerEnabled = flags.configDrawer
export const isE2EEnabled = flags.e2e
export const isRealReportEnabled = flags.realReport
export const isTelemetryEnabled = flags.telemetry
export const isGhostEnabled = flags.ghost
export const isJobsProgressEnabled = flags.jobsProgress
export const isErrorBannersEnabled = flags.errorBanners
export const isRunReportEnabled = flags.runReport
export const isHintsEnabled = flags.hints
export const isParamsEnabled = flags.params
export const isHistoryEnabled = flags.history
export const isExportEnabled = flags.export
export const isReplayEnabled = flags.replay
export const isHistoryRerunEnabled = flags.historyRerun
export const isMarkdownPreviewEnabled = flags.markdownPreview
export const isShortcutsEnabled = flags.shortcuts
export const isCopyCodeEnabled = flags.copyCode
export const isCanvasEnabled = flags.canvas
export const isCanvasDefaultEnabled = flags.canvasDefault
export const isTldrawEnabled = flags.tldraw
export const isScenariosEnabled = flags.scenarios
export const isScenarioImportPreviewEnabled = flags.scenarioImportPreview
export const isDebugEnabled = flags.debug
export const isSnapshotsV2Enabled = flags.snapshotsV2
export const isOnboardingTourEnabled = flags.onboardingTour
export const isSchemaV2Enabled = flags.schemaV2
export const isPlotEnrichmentEnabled = flags.plotEnrichment
export const isOrchestratorV2Enabled = flags.orchestratorV2
export const isLegacyDirectRunEnabled = flags.legacyDirectRun
export const isOrchestratorStreamingEnabled = flags.orchestratorStreaming
export const diagnoseOrchestratorStreaming = () => diagnoseFlagState(FLAGS_CONFIG.orchestratorStreaming)
export const isJourneyTabEnabled = flags.journeyTab
export const isCompareTabEnabled = flags.compareTab
export const isThreadPersistEnabled = flags.threadPersist
export const isThreadHydrateEnabled = flags.threadHydrate
export const isBilPreviewEnabled = flags.bil
export const isPreAnalysisEnrichedEnabled = flags.preAnalysisEnriched
export const isGraphBadgesEnabled = flags.graphBadges
export const isCrossHighlightEnabled = flags.crossHighlight
export const isGraphLensEnabled = flags.graphLens
export const isOrchestratorRenderingV2Enabled = flags.orchestratorRenderingV2
export const isDeterministicCeeEnabled = flags.deterministicCee
export const isAnalysisHeroV17Enabled = flags.analysisHeroV17
export const isAnalysisHeroCompareEnabled = flags.analysisHeroCompare
export const isAiPanelV2Enabled = flags.aiPanelV2


// ============================================================================
// POC FLAGS (special pattern - constant object, not functions)
// ============================================================================

// PoC-aware flags system - defaults to ON when VITE_POC_ONLY=1
const env = (import.meta as any)?.env
const isPoc = env?.VITE_POC_ONLY === '1'

// Helper: returns true if explicitly enabled OR (PoC mode AND not explicitly disabled)
const on = (v?: string) => v === '1' || (isPoc && v !== '0')

// PoC-aware flags - default to ON in PoC mode
export const pocFlags = {
  sse: on(env?.VITE_FEATURE_SSE),
  orchestratorStreaming: on(env?.VITE_FEATURE_ORCHESTRATOR_STREAMING),
  scenarioSandbox: on(env?.VITE_FEATURE_SCENARIO_SANDBOX),
}

// Debug helper: dump all flags for inspection
export function dumpFlags() {
  const isPoc = env?.VITE_POC_ONLY === '1'
  const on = (v?: string) => v === '1' || (isPoc && v !== '0')
  return {
    raw: { ...env },
    resolved: {
      isPoc,
      sse: on(env?.VITE_FEATURE_SSE),
      sandbox: on(env?.VITE_FEATURE_SCENARIO_SANDBOX),
    }
  }
}
