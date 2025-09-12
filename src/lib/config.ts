/**
 * Feature flags and configuration helpers
 *
 * UI must read flags from Flags context (useFlags()).
 * These helpers are for non-UI/runtime code only.
 */

export const cfg = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnon: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  openaiKey: import.meta.env.VITE_OPENAI_API_KEY ?? '',
  featureWhiteboard: import.meta.env.VITE_FEATURE_WHITEBOARD === 'true',
  featureScenarioSandbox: import.meta.env.VITE_FEATURE_SCENARIO_SANDBOX === 'true',
  featureOptionHandles: import.meta.env.VITE_FEATURE_OPTION_HANDLES === 'true',
  featureDecisionGraph: import.meta.env.VITE_FEATURE_DECISION_GRAPH === 'true',
  featureScenarioSnapshots: import.meta.env.VITE_FEATURE_SCENARIO_SNAPSHOTS === 'true',
  featureSandboxStrategyBridge: import.meta.env.VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE === 'true',
  featureSandboxTriggersBasic: import.meta.env.VITE_FEATURE_SANDBOX_TRIGGERS_BASIC === 'true',
  featureSandboxProjections: import.meta.env.VITE_FEATURE_SANDBOX_PROJECTIONS === 'true',
  featureSandboxDecisionCTA: import.meta.env.VITE_FEATURE_SANDBOX_DECISION_CTA === 'true',
  featureSandboxRealtime: import.meta.env.VITE_FEATURE_SANDBOX_REALTIME === 'true',
  featureSandboxVoting: import.meta.env.VITE_FEATURE_SANDBOX_VOTING === 'true',
  featureSandboxDeltaReapplyV2: import.meta.env.VITE_FEATURE_SANDBOX_DELTA_REAPPLY_V2 === 'true',
  featureSandboxMapping: import.meta.env.VITE_FEATURE_SANDBOX_MAPPING === 'true',
  // Network timeouts (ms)
  openaiTimeoutMs: Number.parseInt(import.meta.env.VITE_OPENAI_TIMEOUT_MS ?? '') || 25000,
  supabaseTimeoutMs: Number.parseInt(import.meta.env.VITE_SUPABASE_TIMEOUT_MS ?? '') || 15000,
} as const

export const hasSupabase = !!(cfg.supabaseUrl && cfg.supabaseAnon)

// Back-compat helpers used elsewhere in the app
/** @deprecated Use useFlags() in UI components */
export const isSandboxEnabled = (): boolean => cfg.featureScenarioSandbox
/** @deprecated Use useFlags() in UI components */
export const isVotingEnabled = (): boolean =>
  import.meta.env.VITE_FEATURE_COLLAB_VOTING === 'true'
/** @deprecated Use useFlags() in UI components */
export const isWhiteboardEnabled = (): boolean => cfg.featureWhiteboard || isSandboxEnabled()
/** @deprecated Use useFlags() in UI components */
export const isOptionHandlesEnabled = (): boolean => cfg.featureOptionHandles
/** @deprecated Use useFlags() in UI components */
export const isDecisionGraphEnabled = (): boolean => cfg.featureDecisionGraph
/** @deprecated Use useFlags() in UI components */
export const isScenarioSnapshotsEnabled = (): boolean => cfg.featureScenarioSnapshots
/** @deprecated Use useFlags() in UI components */
export const isStrategyBridgeEnabled = (): boolean => cfg.featureSandboxStrategyBridge
/** @deprecated Use useFlags() in UI components */
export const isSandboxTriggersBasicEnabled = (): boolean => cfg.featureSandboxTriggersBasic
/** @deprecated Use useFlags() in UI components */
export const isProjectionsEnabled = (): boolean => cfg.featureSandboxProjections
/** @deprecated Use useFlags() in UI components */
export const isDecisionCTAEnabled = (): boolean => cfg.featureSandboxDecisionCTA
/** @deprecated Use useFlags() in UI components */
export const isSandboxRealtimeEnabled = (): boolean => cfg.featureSandboxRealtime
/** @deprecated Use useFlags() in UI components */
export const isSandboxVotingEnabled = (): boolean => cfg.featureSandboxVoting
/** @deprecated Use useFlags() in UI components */
export const isSandboxDeltaReapplyV2Enabled = (): boolean => cfg.featureSandboxDeltaReapplyV2
/** @deprecated Use useFlags() in UI components */
export const isSandboxMappingEnabled = (): boolean => cfg.featureSandboxMapping
