/**
 * WhatChangedChip — ONE comparison authority (Compare audit (d), DL #85 5943446984).
 *
 * Contract:
 * - The chip is the ASK "What changed since the last analysis run?". The answer
 *   is the server's run comparison (the CEE send; see the send / reveal specs).
 * - It NEVER renders a browser-derived diff. The client diff over
 *   `olumi-canvas-run-history` is removed: nothing live writes that history (V5
 *   carries no seed), so it could only read LEGACY entries — from any decision.
 *   Measured on served 7403a842: two legacy entries made decision a58f1537 show
 *   "Since your last analysis run: Nodes: +2" from runs that were not its own.
 *
 * The legacy row below uses the REAL `runHistory` module and REAL localStorage
 * (only the pulse is stubbed), so it binds to the storage key the removed diff
 * read, not to a mock that could be satisfied some other way.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { pulseMock } = vi.hoisted(() => ({ pulseMock: vi.fn() }))
vi.mock('../../utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))

import { WhatChangedChip } from '../WhatChangedChip'
import { STORAGE_KEY as RUN_HISTORY_KEY } from '../../store/runHistory'

const ASK = 'What changed since the last analysis run?'

/** A run as the removed direct-Run path stored it (v1.2: with a graph snapshot). */
const legacyRun = (id: string, ts: number, nodeIds: string[]) => ({
  id,
  ts,
  seed: 1,
  adapter: 'httpv1',
  summary: 'legacy',
  graphHash: `g-${id}`,
  report: { schema: 'report.v1' },
  graph: {
    nodes: nodeIds.map((n) => ({ id: n, type: 'factor', position: { x: 0, y: 0 }, data: { label: n } })),
    edges: [],
  },
})

beforeEach(() => {
  localStorage.clear()
  pulseMock.mockReset()
})
afterEach(() => cleanup())

describe('WhatChangedChip — never a browser-derived comparison', () => {
  it('the served (d) repro: two LEGACY stored runs that differ → still only the ask; no counts, no device basis, no pulse', () => {
    expect(RUN_HISTORY_KEY).toBe('olumi-canvas-run-history')
    localStorage.setItem(
      RUN_HISTORY_KEY,
      JSON.stringify([legacyRun('r-old', 1721000000000, ['a', 'b']), legacyRun('r-new', 1721000600000, ['a', 'b', 'c', 'd'])]),
    )

    render(<WhatChangedChip />)

    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.textContent).toBe(ASK)
    expect(chip).toHaveAttribute('aria-label', ASK)
    expect(chip).not.toHaveAttribute('title')
    expect(document.body.textContent).not.toMatch(/Since your last analysis run|on this device|Nodes:|Edges:/)
    chip.click()
    expect(pulseMock).not.toHaveBeenCalled()
  })

  it('CONTRAST: no stored history at all → the same ask (the chip does not depend on local runs)', () => {
    render(<WhatChangedChip />)
    expect(screen.getByTestId('what-changed-chip').textContent).toBe(ASK)
  })
})

describe('WhatChangedChip — a11y + DS', () => {
  it('is a real button whose accessible name is the ACTION, never a disability claim', () => {
    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.tagName).toBe('BUTTON')
    expect(chip).toHaveAttribute('type', 'button')
    expect(chip).toHaveAccessibleName(ASK)
  })

  it('uses DS tokens (info accent, caption type), no raw hex', () => {
    const { container } = render(<WhatChangedChip />)
    const html = container.innerHTML
    expect(html).toMatch(/border-info/)
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
  })
})
