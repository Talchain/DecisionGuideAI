/**
 * ROADMAP 2.234 — the direction domain, closed at the RENDERED SURFACE.
 *
 * The audit named three places: the V5 mapper (`:145-150`), the duplicate
 * collapse in `useResultsSectionData` (`:316-335`), and THIS RENDERER
 * (`V7EvidenceDisclosure.tsx:246-254`), which is where a fabricated
 * `'positive'` finally became a green "+" glyph and the screen-reader sentence
 * "increases the outcome".
 *
 * ⚠ THE RENDERER WAS NEVER THE BUG, and this file says so on purpose.
 * `buildV7Lenses.driverDirection` already narrowed to `positive | negative |
 * null`, and this component already gates its glyph on that. Both were correct
 * and both were being handed a value the producer never sent. These pins exist
 * so the chain is closed END TO END — a fix proven only at the mapper leaves
 * the two hops after it unpinned, and it was exactly such an unpinned hop
 * (`normalizeFactorSensitivity`) that a mutation check caught shipping with no
 * coverage at all.
 *
 * At `900dbd6c` NOTHING asserted the `v7-driver-sign` glyph in either
 * direction — the fixture below already carried a `direction: null` row and no
 * test looked at what it rendered.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7EvidenceDisclosure } from '../V7EvidenceDisclosure'
import { buildV7Lenses } from '../buildV7Lenses'
import type { V7EvidenceModel } from '../buildV7Lenses'
import type { DriverItem } from '../../types'
import { v7EvidenceModel as model } from '@/__fixtures__/v7EvidenceModel'
import { openDisclosureHeader } from '../../../../test/helpers/resolveNextView'

function driversWith(direction: V7EvidenceModel['drivers'][number]['direction']) {
  return [{ factorKey: 'f1', label: 'Market size', direction, isEstimate: false }]
}

describe('V7EvidenceDisclosure — only directional states draw a direction (ROADMAP 2.234)', () => {
  it('positive → a "+" glyph and the "increases the outcome" sentence', () => {
    render(<V7EvidenceDisclosure evidence={model({ drivers: driversWith('positive') })} />)
    openDisclosureHeader()
    expect(screen.getByTestId('v7-driver-sign')).toHaveTextContent('+')
    expect(screen.getByText('(increases the outcome)')).toBeInTheDocument()
  })

  it('negative → a "-" glyph and the "decreases the outcome" sentence', () => {
    render(<V7EvidenceDisclosure evidence={model({ drivers: driversWith('negative') })} />)
    openDisclosureHeader()
    expect(screen.getByTestId('v7-driver-sign')).toHaveTextContent('-')
    expect(screen.getByText('(decreases the outcome)')).toBeInTheDocument()
  })

  it('NO direction → no glyph, no colour, and NO directional sentence for a screen reader', () => {
    render(<V7EvidenceDisclosure evidence={model({ drivers: driversWith(null) })} />)
    openDisclosureHeader()
    // The row still renders — this is honest silence about direction, not a
    // dropped driver.
    expect(screen.getByText('Market size')).toBeInTheDocument()
    expect(screen.queryByTestId('v7-driver-sign')).not.toBeInTheDocument()
    expect(screen.queryByText('(increases the outcome)')).not.toBeInTheDocument()
    expect(screen.queryByText('(decreases the outcome)')).not.toBeInTheDocument()
  })
})

describe('buildV7Lenses — `mixed` and `unknown` reach the renderer as "no direction" (ROADMAP 2.234)', () => {
  function lensesFor(direction: DriverItem['direction']) {
    const drivers = {
      drivers: [
        { factorKey: 'f1', factorLabel: 'Market size', direction } as unknown as DriverItem,
      ],
    }
    return buildV7Lenses({
      recommendation: { allOptions: [], goalThreshold: null },
      drivers,
      confidence: {},
      voiRanking: null,
    } as never)
  }

  it.each(['mixed', 'unknown'] as const)(
    'producer `%s` → `direction: null` on the evidence model (never a directional claim)',
    (domainMember) => {
      expect(lensesFor(domainMember).evidence.drivers[0].direction).toBeNull()
    },
  )

  it('CONTROL — the two directional members still survive the same hop', () => {
    expect(lensesFor('positive').evidence.drivers[0].direction).toBe('positive')
    expect(lensesFor('negative').evidence.drivers[0].direction).toBe('negative')
  })

  it('CONTROL — the row itself is still carried, so this is not a "drivers went dark" pass', () => {
    expect(lensesFor('mixed').evidence.drivers[0].label).toBe('Market size')
  })
})
