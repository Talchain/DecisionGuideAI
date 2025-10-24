export * from './types'
import { plot as mockAdapter } from './mockAdapter'

export type PlotAdapter = typeof mockAdapter

// DEV ONLY: force mock adapter (no remote calls)
export const plot: PlotAdapter = mockAdapter
export const isMock = true
