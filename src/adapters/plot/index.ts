export * from './types'
import { plot as mockAdapter } from './mockAdapter'
import { httpV1Adapter } from './httpV1Adapter'

export type PlotAdapter = typeof mockAdapter

// Select adapter based on env var
const ADAPTER_TYPE = import.meta.env.VITE_PLOT_ADAPTER || 'mock'

export const plot: PlotAdapter = ADAPTER_TYPE === 'httpv1' ? httpV1Adapter as any : mockAdapter
export const isMock = ADAPTER_TYPE === 'mock'
export const adapterName = ADAPTER_TYPE
