/**
 * A5 — the never-run state must win over the import-registration hold.
 *
 * Audit-measured: a never-run model held under an import-registration hold
 * had its footer read "Can't confirm this analysis matches the current
 * model. Re-analyse" — a claim about an analysis that has never existed.
 *
 * ROOT CAUSE: `classifyFreshnessForDisplay` (`analysisFreshness.ts`)
 * returns `'cannot_confirm'` for `importHold && displayed === 'fresh'`
 * BEFORE it ever reaches its own `hasCompletedFirstRun` branch (that fork
 * lives further down, only reachable from `displayed === 'unknown'`), so
 * `semantic` can never actually be `'never_run'` while an import hold is
 * live. `ReanalyseBar` used to derive its `neverRun` flag purely from
 * `semantic === 'never_run'`, so it inherited that unreachability.
 *
 * FIX (this file's scope): `ReanalyseBar` now reads `hasCompletedFirstRun`
 * directly from the store, bypassing the composed `semantic` for this one
 * question, so the never-run copy renders regardless of what `semantic`
 * resolves to under a hold.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReanalyseBar } from '../ReanalyseBar'

let mockFreshness: { freshness: string } | null = null
let mockDirty = false
let mockImportHold = false
let mockHasCompletedFirstRun = true

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      analysisFreshness: mockFreshness,
      analysisFreshnessDirty: mockDirty,
      importPendingServerRegistration: mockImportHold,
      hasCompletedFirstRun: mockHasCompletedFirstRun,
    })
  ),
}))

const NO_GATE = { canRun: undefined, blockedReason: undefined, isAnalysing: undefined } as const

describe('ReanalyseBar — A5 never-run wins over the import-registration hold', () => {
  it('PRECONDITION: an import hold on a retained-fresh verdict classifies as cannot-confirm, not never-run (root cause, unaffected by this fix)', () => {
    // Documents WHY `semantic` alone cannot be trusted for this question —
    // not a claim this bar's own render makes.
    mockFreshness = { freshness: 'fresh' }
    mockDirty = false
    mockImportHold = true
    mockHasCompletedFirstRun = true
    render(<ReanalyseBar {...NO_GATE} />)
    expect(screen.getByTestId('reanalyse-bar')).toHaveAttribute('data-reason', 'import-unregistered')
    expect(screen.getByText(/Can't confirm this analysis matches the current model/)).toBeInTheDocument()
  })

  it('RED/A5: the SAME held state, but no run has ever completed — the bar must say never-run, not cannot-confirm', () => {
    mockFreshness = { freshness: 'fresh' }
    mockDirty = false
    mockImportHold = true
    mockHasCompletedFirstRun = false
    render(<ReanalyseBar {...NO_GATE} />)
    expect(screen.getByTestId('reanalyse-bar')).toHaveAttribute('data-reason', 'never-run')
    expect(screen.getByText('This model has not been analysed yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Can't confirm this analysis matches the current model/)).toBeNull()
    expect(screen.queryByText(/changed/i)).toBeNull()
  })

  it('a never-run model with NO hold also renders the never-run copy (the affordance stays, the claim goes)', () => {
    mockFreshness = null
    mockDirty = false
    mockImportHold = false
    mockHasCompletedFirstRun = false
    render(<ReanalyseBar {...NO_GATE} />)
    expect(screen.getByTestId('reanalyse-bar')).toHaveAttribute('data-reason', 'never-run')
    expect(screen.getByTestId('reanalyse-button')).toBeInTheDocument()
  })
})
