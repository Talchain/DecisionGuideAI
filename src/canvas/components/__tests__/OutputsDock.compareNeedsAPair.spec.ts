/**
 * Workstream D (Paul 8 Oct, "overcomplicated, bad design"): no tab that opens onto nothing.
 *
 * Measured on served 044f1a2d (guest, Paul's brief, after the draft and after a Run): Compare opened on
 * "No comparison yet" both times. It is now offered only once the run pair exists — the same
 * `useDisplayedRunDeltaView` reader its body uses — and a route that asks for it before then lands on Reasoning.
 */
import { describe, it, expect } from 'vitest'
import { resolvePresentedTab } from '../OutputsDock'
import { UNFLAGGED_FALLBACK_SURFACE } from '../workspaceShell/shellContract'

describe('resolvePresentedTab: Compare needs a pair', () => {
  it('no pair yet → a request for Compare lands on the unflagged fallback (Reasoning)', () => {
    expect(UNFLAGGED_FALLBACK_SURFACE).toBe('analysisNew')
    expect(resolvePresentedTab('compare', false)).toBe('analysisNew')
  })

  it('CONTRAST: once a pair exists, Compare is honoured as asked', () => {
    expect(resolvePresentedTab('compare', true)).toBe('compare')
  })

  it('every other tab is untouched by the pair, either way', () => {
    for (const tab of ['olumi', 'results', 'analysisNew', 'diagnostics'] as const) {
      expect(resolvePresentedTab(tab, false)).toBe(tab)
      expect(resolvePresentedTab(tab, true)).toBe(tab)
    }
  })
})
