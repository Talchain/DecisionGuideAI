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

/**
 * Finds the exact expert-block container (the structural wrapper around
 * the elasticity/stability/influence trio) so assertions can target the
 * block itself, not just the individual strings inside it. Returns null
 * when the block is absent.
 */
function findExpertTrioBlock(container: HTMLElement): HTMLElement | null {
  // The block renders `<div>` with a side-by-side flex of three
  // <span>s — elasticity, stability, influence — in that DOM order.
  // Query by the first span's prefix and walk up to the flex parent.
  const firstSpan = Array.from(container.querySelectorAll('span')).find(
    el => el.textContent?.startsWith('elasticity:') ?? false,
  )
  if (!firstSpan) return null
  return firstSpan.parentElement as HTMLElement | null
}

describe('DriversSection: Brief 5.1 Task 1 — expert leak regression', () => {
  it('standard view (expertMode unset) renders none of the expert trio', () => {
    const { container } = render(
      <DriversSection data={makeData([makeDriver()])} goalLabel="Win rate" />,
    )

    // Individual strings absent.
    expect(screen.queryByText(/^elasticity:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^stability:\s/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^influence:/)).not.toBeInTheDocument()
    // Structural check: the expert trio block itself is absent (not just
    // the text — no empty wrapper, no hidden flex container).
    expect(findExpertTrioBlock(container)).toBeNull()
  })

  it('standard view (expertMode=false) renders none of the expert trio', () => {
    const { container } = render(
      <DriversSection
        data={makeData([makeDriver()])}
        goalLabel="Win rate"
        expertMode={false}
      />,
    )

    expect(screen.queryByText(/^elasticity:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^stability:\s/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^influence:/)).not.toBeInTheDocument()
    expect(findExpertTrioBlock(container)).toBeNull()
  })

  it('expert view (expertMode=true) renders all three strings inside the ExpertBlock wrapper in the canonical DOM order', () => {
    const { container } = render(
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

    // Structural: all three spans share the same parent (the expert
    // flex container) and appear in the canonical order.
    const block = findExpertTrioBlock(container)
    expect(block).not.toBeNull()
    const labels = Array.from(block!.children).map(el => el.textContent ?? '')
    expect(labels[0]).toMatch(/^elasticity:/)
    expect(labels[1]).toMatch(/^stability:/)
    expect(labels[2]).toMatch(/^influence:/)

    // Structural: the block is wrapped in the info-tinted ExpertBlock.
    // ExpertBlock uses an inline background-color style rather than a
    // class we can match directly, so assert the DS rgba string is
    // present on a parent.
    let cursor: HTMLElement | null = block
    let foundExpertWrapper = false
    while (cursor) {
      if ((cursor.style.backgroundColor ?? '').includes('99, 173, 207')) {
        foundExpertWrapper = true
        break
      }
      cursor = cursor.parentElement
    }
    expect(foundExpertWrapper).toBe(true)
  })
})
