/**
 * Reasoning's "Since your last run" receipt (Paul, 20 Oct 2026): at most two rows; row 2 is the highest-level difference
 * as CEE states it. The figures are the chance gate's (`usePairChanceFigures`, mocked here at that seam only).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PairChanceFigures } from '../../../../canvas/runView/runView'
import type { RunDeltaView } from '../runDeltaView'

let figures: PairChanceFigures | null = null
vi.mock('../../../../canvas/compare-tab/usePairChanceFigures', () => ({ usePairChanceFigures: () => figures }))

const { WhatsChangedReceipt, WHATS_CHANGED_RECEIPT_TESTID } = await import('../sections/WhatsChangedReceipt')

const view = { comparedWith: 'Compared with the earlier run at 14:02.' } as unknown as RunDeltaView
const point = (n: number, words: string) => ({ kind: 'point' as const, words, scaleAt: n })
const rows = [
  { optionId: 'a', label: 'Raise prices', earlier: point(41, 'about 41%'), now: point(58, 'about 58%') },
  { optionId: 'b', label: 'Cut waste', earlier: point(39, 'about 39%'), now: point(44, 'about 44%') },
]

describe('"Since your last run": the comparison at one glance', () => {
  beforeEach(() => { figures = null })

  it("CEE names the most likely option → that option, its mini track and this run's figure, in two rows", () => {
    figures = { rows, claim: { kind: 'highest', optionId: 'a' }, chanceWords: null, notCurrent: false }
    render(<WhatsChangedReceipt view={view} responseHash="h" />)
    const glance = screen.getByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-glance`)
    expect(glance.getAttribute('data-option-id')).toBe('a')
    expect(glance.textContent).toContain('Raise prices is the most likely to meet your goal in this model: earlier run about 41%, this run about 58%')
    expect(glance.querySelector('[data-mark="earlier"]')).not.toBeNull()
    expect(glance.querySelector('[data-mark="now"]')).not.toBeNull()
    // A long name truncates at panel width; its full text stays one hover away (staging, 21 Oct: "Option A (a refer…").
    expect(glance.querySelector('[title="Raise prices"]')).not.toBeNull()
    // Two rows: the heading row and the glance; the old "compared with" line is not a third.
    expect(screen.queryByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-compared-with`)).toBeNull()
    expect(screen.getByTestId(WHATS_CHANGED_RECEIPT_TESTID).textContent).not.toMatch(/Cut waste|best|winner|recommend/i)
  })

  it("the glance's ruled sentence carries CEE's claim identities (the census binds the exemption to them)", () => {
    figures = { rows, claim: { kind: 'highest', optionId: 'a' }, chanceWords: null, notCurrent: false }
    render(<WhatsChangedReceipt view={view} responseHash="h" />)
    const line = screen.getByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-glance`).querySelector('[data-goal-chance-claim]')
    expect(line?.getAttribute('data-goal-chance-claim')).toBe('highest')
    expect(line?.getAttribute('data-option-id')).toBe('a')
  })

  it('no goal-chance claim (contrast: the same rows with a claim draw the glance above) → the earlier run it is compared with', () => {
    figures = { rows, claim: null, chanceWords: null, notCurrent: false }
    render(<WhatsChangedReceipt view={view} responseHash="h" />)
    expect(screen.getByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-compared-with`).textContent).toBe('Compared with the earlier run at 14:02.')
    expect(screen.queryByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-glance`)).toBeNull()
  })

  it("a named leader with no figure this run → no glance (never an invented mark)", () => {
    figures = { rows: [{ ...rows[0], now: null }], claim: { kind: 'highest', optionId: 'a' }, chanceWords: null, notCurrent: false }
    render(<WhatsChangedReceipt view={view} responseHash="h" />)
    expect(screen.queryByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-glance`)).toBeNull()
  })
})
