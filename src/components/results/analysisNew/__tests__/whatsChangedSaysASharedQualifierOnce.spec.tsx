/**
 * Served D1 (fe5666b8): four rows each repeated "Too small to tell apart from
 * ordinary run-to-run variation." When every row carries the same producer
 * verdict, the qualifier is said once above the list; each row keeps its
 * verdict in the DOM. A single row keeps its own qualifier.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { WhatsChanged, WHATS_CHANGED_TESTID as T } from '../sections/WhatsChanged'
import { buildRunDeltaView } from '../runDeltaView'

const row = (option_id: string, prior: number, current: number, noise_verdict: string) => ({ option_id, prior, current, noise_verdict })
const view = (rows: ReturnType<typeof row>[]) => buildRunDeltaView({
  attribution_case: 'C2_unpaired',
  pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: rows,
  flip_thresholds: [],
} as unknown as RunDelta, (id) => ({ a: '£59 price', b: 'Keep £49', c: 'Carry on' } as Record<string, string>)[id] ?? null)

afterEach(cleanup)

describe('a qualifier every row shares is said once', () => {
  it('served shape: three within_noise rows → one shared line, rows carry only their figures', () => {
    render(<WhatsChanged view={view([row('a', 0.81, 0.82, 'within_noise'), row('b', 0.15, 0.14, 'within_noise'), row('c', 0.02, 0.02, 'within_noise')])} />)
    expect(screen.getByTestId(`${T}-shared-qualifier`).textContent).toMatch(/run-to-run/i)
    const rows = screen.getAllByTestId(`${T}-movement`)
    expect(rows).toHaveLength(3)
    for (const r of rows) {
      expect(r.textContent).not.toMatch(/run-to-run/i)
      expect(r).toHaveAttribute('data-noise-verdict', 'within_noise')
    }
  })

  it('CONTRAST: mixed verdicts keep each row’s own qualifier', () => {
    render(<WhatsChanged view={view([row('a', 0.81, 0.62, 'signal'), row('b', 0.15, 0.14, 'within_noise')])} />)
    expect(screen.queryByTestId(`${T}-shared-qualifier`)).toBeNull()
    expect(screen.getAllByTestId(`${T}-movement`)[1].textContent).toMatch(/run-to-run/i)
  })

  it('CONTRAST: all signal has no qualifier to share', () => {
    render(<WhatsChanged view={view([row('a', 0.81, 0.62, 'signal'), row('b', 0.15, 0.34, 'signal')])} />)
    expect(screen.queryByTestId(`${T}-shared-qualifier`)).toBeNull()
  })
})
