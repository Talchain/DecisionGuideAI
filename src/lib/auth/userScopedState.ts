import { useCanvasStore } from '../../canvas/store'
import { clearAllScenarioStorage } from '../../canvas/store/scenarios'
import { clearAllTranscripts } from '../../canvas/conversation/utils/transcriptStore'
import { clearAllVersions } from '../../canvas/versions/versionStorage'
import { useLayoutStore } from '../../canvas/layoutStore'
import { clearDurableDissent } from '../../canvas/stores/dissentStore'
import { useStrengthenStore } from '../../canvas/stores/strengthenStore'
import { useDecisionRecordStore } from '../../components/results/modals/decisionRecordStore'
import { useSuccessMeasureStore } from '../../components/results/modals/successMeasureStore'

/** All browser state that belongs to an authenticated user's reasoning work. */
export const USER_SCOPED_STORAGE_KEYS = [
  'olumi-canvas-scenarios', 'olumi-canvas-autosave', 'olumi-canvas-current-scenario-id',
  'olumi-canvas-model-versions-v1', 'olumi-canvas-transcript',
  'defineSuccess.measure.v1', 'strengthen.lifecycle.v1', 'canvas-layout-options-v6',
  'canvas-layout-options-v5', 'canvas-layout-options-v4', 'olumi-cee-analysis-ready',
  'olumi-cee-analysis-ready-node-ids',
] as const

// `olumi-canvas-autosave:` — a cold-load deep link's preserved copies (`scenarios.keyedAutosaveKey`): one per scenario,
// unbounded, and as private as the main slot above.
export const USER_SCOPED_STORAGE_PREFIXES = ['olumi.dissent.v2.', 'olumi.dissent.', 'olumi-canvas-autosave:'] as const

/** One identity boundary for sign-out and A→B auth transitions. */
export function clearUserScopedState(): void {
  useCanvasStore.getState().resetCanvas()
  clearAllScenarioStorage()
  clearAllTranscripts()
  clearAllVersions()
  useLayoutStore.getState().resetForAuth()
  clearDurableDissent()
  useStrengthenStore.getState()._reset()
  useDecisionRecordStore.getState()._reset()
  useSuccessMeasureStore.getState()._reset()
  try {
    for (const key of USER_SCOPED_STORAGE_KEYS) localStorage.removeItem(key)
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i)
      if (key && USER_SCOPED_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key)
    }
    sessionStorage.removeItem('olumi-cee-analysis-ready')
    sessionStorage.removeItem('olumi-cee-analysis-ready-node-ids')
  } catch { /* browser storage can be unavailable */ }
}
