export * from './types'
import { httpV1Adapter } from './httpV1Adapter'

export type PlotAdapter = typeof httpV1Adapter

// PRODUCTION: Only httpv1 adapter - no mock fallback
const ADAPTER_TYPE = import.meta.env.VITE_PLOT_ADAPTER || 'httpv1'

if (ADAPTER_TYPE !== 'httpv1') {
  console.error(`❌ Invalid VITE_PLOT_ADAPTER="${ADAPTER_TYPE}". Only "httpv1" is supported.`)
  throw new Error(`Unsupported adapter: ${ADAPTER_TYPE}. Please set VITE_PLOT_ADAPTER=httpv1`)
}

export const plot: PlotAdapter = httpV1Adapter
export const isMock = false
export const adapterName = 'httpv1'
