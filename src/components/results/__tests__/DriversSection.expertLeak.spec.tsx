/**
 * DriversSection Brief 5.1 Task 1: expert-mode regression guard.
 *
 * Protects the gate at DriversSection.tsx around the `elasticity: / stability: /
 * influence:` trio. Standard view must never render these strings; expert view
 * must render all three. The gate is `expertMode && isExpertField('elasticity')`
 * — a belt-and-braces pattern that matches HeroSection's expert-field gating
 * and keeps rendering tied to the canonical allowlist in isExpertField.ts.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'factor-1',
    factorLabel: 'Task Handling Quality',
    rawElasticity: 1.0,
    normalisedInfluence: 1.0,
    influenceScore: 1.0,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node-1',
    attributionStability: 'negligible',
    ...overrides,
  }
}

function makeData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
  }
}

describe('DriversSection: Brief 5.1 Task 1 — expert leak regression', () => {
  it('standard view (expertMode unset) renders none of the expert trio', () => {
    render(<DriversSection data={makeData([makeDriver()])} goalLabel="Win rate" />)

    // Each expert string must be absent individually.
    expect(screen.queryByText(/^elasticity:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^stability:\s/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^influence:/)).not.toBeInTheDocument()
  })

  it('standard view (expertMode=false) renders none of the expert trio', () => {
    render(
      <DriversSection
        data={makeData([makeDriver()])}
        goalLabel="Win rate"
        expertMode={false}
      />,
    )

    expect(screen.queryByText(/^elasticity:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^stability:\s/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^influence:/)).not.toBeInTheDocument()
  })

  it('expert view (expertMode=true) renders all three strings with formatted values', () => {
    render(
      <DriversSection
        data={makeData([makeDriver()])}
        goalLabel="Win rate"
        expertMode
      />,
    )

    // Formatted precisely as the JSX dictates: elasticity.toFixed(3),
    // attributionStability as-is, influence as percentage with 1dp.
    expect(screen.getByText('elasticity: 1.000')).toBeInTheDocument()
    expect(screen.getByText('stability: negligible')).toBeInTheDocument()
    expect(screen.getByText('influence: 100.0%')).toBeInTheDocument()
  })
})
