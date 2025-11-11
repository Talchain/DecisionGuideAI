export * from './types'
import { plot as mockAdapter } from './mockAdapter'
import { httpV1Adapter } from './httpV1Adapter'
import { autoDetectAdapter } from './autoDetectAdapter'

export type PlotAdapter = typeof mockAdapter

// Adapter selection:
// - 'mock': Always use mock (local development)
// - 'httpv1': Always use httpv1 (when confirmed available)
// - 'auto' or unset: Auto-detect (probe + fallback)
const ADAPTER_TYPE = (import.meta.env.VITE_PLOT_ADAPTER || 'auto') as 'mock' | 'httpv1' | 'auto'

export const plot: PlotAdapter =
  ADAPTER_TYPE === 'mock' ? mockAdapter :
  ADAPTER_TYPE === 'httpv1' ? httpV1Adapter as any :
  autoDetectAdapter as any

export const isMock = ADAPTER_TYPE === 'mock'
export const adapterName = ADAPTER_TYPE

if (import.meta.env.DEV) {
  console.log(`[Adapter] Mode: ${adapterName}`)
}

// Re-export probe utilities for UI
export { getProbeStatus, reprobeCapability, getAdapterMode } from './autoDetectAdapter'
