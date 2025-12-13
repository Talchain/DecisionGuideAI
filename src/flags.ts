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
//   - isDecisionReviewEnabled → Show CEE decision review UI
//
// DO NOT USE FOR:
//   - Environment detection (dev/prod/E2E) → use lib/featureFlags.ts
//   - Service base URLs → use lib/featureFlags.ts
//   - Analytics/Sentry toggles → use lib/featureFlags.ts
//
// See also: src/lib/featureFlags.ts for infrastructure/environment flags
// ============================================================================

import { makeFlag } from './lib/flagFactory'

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
  decisionReview: {
    envKey: 'VITE_FEATURE_DECISION_REVIEW',
    storageKey: 'feature.decisionReview',
    defaultValue: true,
  },
  diagnostics: {
    envKey: 'VITE_FEATURE_DIAGNOSTICS',
    storageKey: 'feature.diagnostics',
    defaultValue: true,
  },
  scenariosV2: {
    envKey: 'VITE_FEATURE_SCENARIOS_V2',
    storageKey: 'feature.scenariosV2',
  },
  a11yPolish: {
    envKey: 'VITE_FEATURE_A11Y_POLISH',
    storageKey: 'feature.a11yPolish',
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
  confidenceChips: {
    envKey: 'VITE_FEATURE_CONFIDENCE_CHIPS',
    storageKey: 'feature.confidenceChips',
  },
  telemetry: {
    envKey: 'VITE_FEATURE_TELEMETRY',
    storageKey: 'feature.telemetry',
  },
  sseAuto: {
    envKey: '', // localStorage-only flag (no env var)
    storageKey: 'feature.sseAuto',
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
  sandboxDecisionCta: {
    envKey: 'VITE_FEATURE_SANDBOX_DECISION_CTA',
    storageKey: 'feature.sandboxDecisionCta',
  },
  sandboxMapping: {
    envKey: 'VITE_FEATURE_SANDBOX_MAPPING',
    storageKey: 'feature.sandboxMapping',
  },
  sandboxProjections: {
    envKey: 'VITE_FEATURE_SANDBOX_PROJECTIONS',
    storageKey: 'feature.sandboxProjections',
  },
  sandboxRealtime: {
    envKey: 'VITE_FEATURE_SANDBOX_REALTIME',
    storageKey: 'feature.sandboxRealtime',
  },
  sandboxStrategyBridge: {
    envKey: 'VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE',
    storageKey: 'feature.sandboxStrategyBridge',
  },
  sandboxTriggersBasic: {
    envKey: 'VITE_FEATURE_SANDBOX_TRIGGERS_BASIC',
    storageKey: 'feature.sandboxTriggersBasic',
  },
  sandboxVoting: {
    envKey: 'VITE_FEATURE_SANDBOX_VOTING',
    storageKey: 'feature.sandboxVoting',
  },
  whiteboard: {
    envKey: 'VITE_FEATURE_WHITEBOARD',
    storageKey: 'feature.whiteboard',
  },
  inputsOutputs: {
    envKey: 'VITE_FEATURE_INPUTS_OUTPUTS',
    storageKey: 'feature.inputsOutputs',
    defaultValue: true,
  },
  commandPalette: {
    envKey: 'VITE_FEATURE_COMMAND_PALETTE',
    storageKey: 'feature.commandPalette',
    defaultValue: true,
  },
  degradedBanner: {
    envKey: 'VITE_FEATURE_DEGRADED_BANNER',
    storageKey: 'feature.degradedBanner',
    defaultValue: true,
  },
  optimiseBeta: {
    envKey: 'VITE_FEATURE_OPTIMISE_BETA',
    storageKey: 'feature.optimiseBeta',
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
  decisionReview: makeFlag(FLAGS_CONFIG.decisionReview),
  scorecard: makeFlag(FLAGS_CONFIG.scorecard),
  diagnostics: makeFlag(FLAGS_CONFIG.diagnostics),
  scenariosV2: makeFlag(FLAGS_CONFIG.scenariosV2),
  a11yPolish: makeFlag(FLAGS_CONFIG.a11yPolish),
  perfProbes: makeFlag(FLAGS_CONFIG.perfProbes),
  canvasSimplify: makeFlag(FLAGS_CONFIG.canvasSimplify),
  listView: makeFlag(FLAGS_CONFIG.listView),
  engineMode: makeFlag(FLAGS_CONFIG.engineMode),
  mobileGuardrails: makeFlag(FLAGS_CONFIG.mobileGuardrails),
  configDrawer: makeFlag(FLAGS_CONFIG.configDrawer),
  e2e: makeFlag(FLAGS_CONFIG.e2e),
  realReport: makeFlag(FLAGS_CONFIG.realReport),
  confidenceChips: makeFlag(FLAGS_CONFIG.confidenceChips),
  telemetry: makeFlag(FLAGS_CONFIG.telemetry),
  sseAuto: makeFlag(FLAGS_CONFIG.sseAuto),
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
  sandboxDecisionCta: makeFlag(FLAGS_CONFIG.sandboxDecisionCta),
  sandboxMapping: makeFlag(FLAGS_CONFIG.sandboxMapping),
  sandboxProjections: makeFlag(FLAGS_CONFIG.sandboxProjections),
  sandboxRealtime: makeFlag(FLAGS_CONFIG.sandboxRealtime),
  sandboxStrategyBridge: makeFlag(FLAGS_CONFIG.sandboxStrategyBridge),
  sandboxTriggersBasic: makeFlag(FLAGS_CONFIG.sandboxTriggersBasic),
  sandboxVoting: makeFlag(FLAGS_CONFIG.sandboxVoting),
  whiteboard: makeFlag(FLAGS_CONFIG.whiteboard),
  inputsOutputs: makeFlag(FLAGS_CONFIG.inputsOutputs),
  commandPalette: makeFlag(FLAGS_CONFIG.commandPalette),
  degradedBanner: makeFlag(FLAGS_CONFIG.degradedBanner),
  optimiseBeta: makeFlag(FLAGS_CONFIG.optimiseBeta),
  debug: makeFlag(FLAGS_CONFIG.debug),
  snapshotsV2: makeFlag(FLAGS_CONFIG.snapshotsV2),
  onboardingTour: makeFlag(FLAGS_CONFIG.onboardingTour),
}

// Export with original naming convention for backward compatibility
export const isSseEnabled = flags.sseStreaming
export const isSummaryV2Enabled = flags.summaryV2
export const isGuidedV1Enabled = flags.guidedV1
export const isCommentsEnabled = flags.comments
export const isSnapshotsEnabled = flags.snapshots
export const isCompareEnabled = flags.compare
export const isDecisionReviewEnabled = flags.decisionReview
export const isScorecardEnabled = flags.scorecard
export const isDiagnosticsEnabled = flags.diagnostics
export const isScenariosV2Enabled = flags.scenariosV2
export const isA11yPolishEnabled = flags.a11yPolish
export const isPerfProbesEnabled = flags.perfProbes
export const isCanvasSimplifyEnabled = flags.canvasSimplify
export const isListViewEnabled = flags.listView
export const isEngineModeEnabled = flags.engineMode
export const isMobileGuardrailsEnabled = flags.mobileGuardrails
export const isConfigDrawerEnabled = flags.configDrawer
export const isE2EEnabled = flags.e2e
export const isRealReportEnabled = flags.realReport
export const isConfidenceChipsEnabled = flags.confidenceChips
export const isTelemetryEnabled = flags.telemetry
export const isSseAutoEnabled = flags.sseAuto
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
export const isSandboxDecisionCtaEnabled = flags.sandboxDecisionCta
export const isSandboxMappingEnabled = flags.sandboxMapping
export const isSandboxProjectionsEnabled = flags.sandboxProjections
export const isSandboxRealtimeEnabled = flags.sandboxRealtime
export const isSandboxStrategyBridgeEnabled = flags.sandboxStrategyBridge
export const isSandboxTriggersBasicEnabled = flags.sandboxTriggersBasic
export const isSandboxVotingEnabled = flags.sandboxVoting
export const isWhiteboardEnabled = flags.whiteboard
export const isInputsOutputsEnabled = flags.inputsOutputs
export const isCommandPaletteEnabled = flags.commandPalette
export const isDegradedBannerEnabled = flags.degradedBanner
export const isOptimiseBetaEnabled = flags.optimiseBeta
export const isDebugEnabled = flags.debug
export const isSnapshotsV2Enabled = flags.snapshotsV2
export const isOnboardingTourEnabled = flags.onboardingTour

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
  scenarioSandbox: on(env?.VITE_FEATURE_SCENARIO_SANDBOX),
  decisionCta: on(env?.VITE_FEATURE_SANDBOX_DECISION_CTA),
  mapping: on(env?.VITE_FEATURE_SANDBOX_MAPPING),
  projections: on(env?.VITE_FEATURE_SANDBOX_PROJECTIONS),
  realtime: on(env?.VITE_FEATURE_SANDBOX_REALTIME),
  strategyBridge: on(env?.VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE),
  triggersBasic: on(env?.VITE_FEATURE_SANDBOX_TRIGGERS_BASIC),
  voting: on(env?.VITE_FEATURE_SANDBOX_VOTING),
  whiteboard: on(env?.VITE_FEATURE_WHITEBOARD),
  contextBar: on(env?.VITE_FEATURE_CONTEXT_BAR),
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
      mapping: on(env?.VITE_FEATURE_SANDBOX_MAPPING),
      projections: on(env?.VITE_FEATURE_SANDBOX_PROJECTIONS),
      realtime: on(env?.VITE_FEATURE_SANDBOX_REALTIME),
      strategyBridge: on(env?.VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE),
      triggers: on(env?.VITE_FEATURE_SANDBOX_TRIGGERS_BASIC),
      voting: on(env?.VITE_FEATURE_SANDBOX_VOTING),
      whiteboard: on(env?.VITE_FEATURE_WHITEBOARD),
    }
  }
}

// ============================================================================
// MIGRATION COMPLETE ✅
// ============================================================================
//
// BEFORE: 751 lines (47 standard flag functions × ~16 lines each + pocFlags + dumpFlags)
// AFTER:  ~355 lines (47 flags refactored via factory + pocFlags + dumpFlags preserved)
// SAVINGS: ~396 lines eliminated (~53% reduction)
// PATTERN: Each standard flag is now just 3 lines instead of 16 (13 lines saved per flag)
//
// All 47 standard flags have been migrated to the factory pattern.
// Special-case flags (pocFlags, dumpFlags) preserved as-is.
