import { vi } from 'vitest'

// A complete set of flag functions used across the app/tests
// Default: all OFF. Pass overrides to flip specific flags ON.
export type FlagFns = Record<string, () => boolean>

export function mockFlags(overrides: Partial<FlagFns> = {}) {
  const base: FlagFns = {
    isSseEnabled: () => false,
    isSseStreamingEnabled: () => false, // alias for safety if referenced anywhere
    isMarkdownPreviewEnabled: () => false,
    isCopyCodeEnabled: () => false,
    isRunReportEnabled: () => false,
    isRealReportEnabled: () => false,
    isJobsProgressEnabled: () => false,
    isConfidenceChipsEnabled: () => false,
    isExportEnabled: () => false,
    isReportCopyEnabled: () => false,
    isHintsEnabled: () => false,
    isParamsEnabled: () => false,
    isConfigDrawerEnabled: () => false,
    isCanvasEnabled: () => false,
    isCanvasDefaultEnabled: () => false,
    // Step 2 features (OFF by default)
    isCanvasSimplifyEnabled: () => false,
    isListViewEnabled: () => false,
    isEngineModeEnabled: () => false,
    isMobileGuardrailsEnabled: () => false,
    isScenariosEnabled: () => false,
    isScenarioImportPreviewEnabled: () => false,
    isTldrawEnabled: () => false,
    isHistoryEnabled: () => false,
    isHistoryRerunEnabled: () => false,
    isReplayEnabled: () => false,
    isShortcutsEnabled: () => false,
    isTelemetryEnabled: () => false,
    isE2EEnabled: () => false,
    // New feature set (OFF by default)
    isSummaryV2Enabled: () => false,
    isGuidedV1Enabled: () => false,
    isCommentsEnabled: () => false,
    isSnapshotsEnabled: () => false,
    isCompareEnabled: () => false,
    isScorecardEnabled: () => false,
    isDiagnosticsEnabled: () => false,
    isScenariosV2Enabled: () => false,
    isA11yPolishEnabled: () => false,
    isPerfProbesEnabled: () => false,
    isInputsOutputsEnabled: () => false,
    isCommandPaletteEnabled: () => false,
    isDegradedBannerEnabled: () => false,
    isOptimiseBetaEnabled: () => false,
    isDebugEnabled: () => false,
    isSnapshotsV2Enabled: () => false,
  }
  const flags = { ...base, ...overrides } as FlagFns
  vi.doMock('../../flags', () => flags)
  return flags
}
