export * from './types'
import { mock } from './mockAdapter'

export type PlotAdapter = typeof mock

// DEV ONLY: force mock adapter (no remote calls)
export const plot: PlotAdapter = mock
export const isMock = true
