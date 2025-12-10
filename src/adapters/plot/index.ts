export * from './types'
import { httpV1Adapter } from './httpV1Adapter'
import { autoDetectAdapter, BackendUnavailableError } from './autoDetectAdapter'

export type PlotAdapter = typeof httpV1Adapter

// Adapter selection:
// - 'httpv1': Always use httpv1 (direct, no probe)
// - 'auto' or unset: Auto-detect with probe, throws clear error if unavailable
const ADAPTER_TYPE = (import.meta.env.VITE_PLOT_ADAPTER || 'auto') as 'httpv1' | 'auto'

export const plot: PlotAdapter =
  ADAPTER_TYPE === 'httpv1' ? httpV1Adapter as any :
  autoDetectAdapter as any

export const adapterName = ADAPTER_TYPE

if (import.meta.env.DEV) {
  console.log(`[Adapter] Mode: ${adapterName}`)
}

// Re-export probe utilities for UI
export { getProbeStatus, reprobeCapability, getAdapterMode, BackendUnavailableError } from './autoDetectAdapter'
