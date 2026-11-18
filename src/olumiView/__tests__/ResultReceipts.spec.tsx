import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat } from '../ViewChat'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { ViewTurn } from '../client'
import { ResultReceipts } from '../ResultReceipts'

type Claim = NonNullable<NonNullable<ViewTurn['answer']>['claims']>[number]
const first: Claim = {
  cite: '[[chance:bridge:cash:a1]]', analysis: 'a1', result: 'bridge:cash', option: 'bridge', optionName: 'Angel bridge',
  aim: 'cash', aimName: 'First cash in eight weeks', status: 'what-if', version: 2, origin: '2026-11-14',
  figure: 'about 10%', conditions: 'If investors reply within a week', basis: 'One cheque clears the target',
  rendered: 'about 10% on this what-if', superseded: false,
  assumptions: [{ figure: 'speed', label: 'Timing improvement', unit: 'weeks', value: { low: 2, high: 6, likely: 4 } }],
}
afterEach(cleanup)

describe('the basis of an answer', () => {
  it('keeps each version and condition attached to its original option and aim, including equal percentages', () => {
    render(<ResultReceipts claims={[first, { ...first, cite: '[[chance:firms:round:a2]]', analysis: 'a2', result: 'firms:round',
      option: 'firms', optionName: 'Institutional round', aim: 'round', aimName: 'Main round closed', version: 1, status: 'saved',
      basis: 'The full round must close', conditions: 'Subject to a lead investor', superseded: true, assumptions: [] }]} />)
    const toggle = screen.getByText('What these results rest on')
    const details = toggle.closest('details')!
    expect(details.open).toBe(false)
    toggle.click()
    expect(details.open).toBe(true)
    const row = screen.getByText('Angel bridge').closest('li')!
    expect(within(row).getByText(/If investors reply within a week/)).toBeTruthy()
    expect(row.textContent).toContain('Timing improvement · 2 to 6 (most likely 4) weeks')
    expect(row.textContent).toContain('What-if · Based on version 2')
    expect(row.textContent).not.toContain('lead investor')
    const older = screen.getByText('Institutional round').closest('li')!
    expect(older.textContent).toContain('Saved model · Version 1 · Before the changes')
    expect(older.textContent).toContain('Subject to a lead investor')
  })
  it('keeps older and explicitly unitless what-ifs readable without guessing a unit', () => {
    render(<ResultReceipts claims={[{ ...first, assumptions: [
      { figure: 'legacy', label: 'Old input', value: { point: 3 } },
      { figure: 'empty', label: 'Input without a unit', value: { point: 5 }, unit: null },
      { figure: 'dim', label: 'Multiplier', value: { point: 0.5 }, unit: '1' },
      { figure: 'open', label: 'Timing', value: { asked: 'When does the cheque clear?' }, unit: 'weeks' },
    ] }]} />)
    expect(screen.getByText('Old input · 3')).toBeTruthy()
    expect(screen.getByText('Input without a unit · 5')).toBeTruthy()
    expect(screen.getByText('Multiplier · 0.5')).toBeTruthy()
    expect(screen.getByText('Timing · When does the cheque clear?')).toBeTruthy()
  })
  it('places the disclosure on the saved chat reply that actually contains the cited words', () => {
    const fixture: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.view.json'), 'utf8'))
    const index = fixture.chat.findIndex(t => t.answer !== null)
    const turn = fixture.chat[index]!
    turn.answer = { ...turn.answer!, answer: [{ text: first.rendered }], claims: [first] }
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-cb215d057b96', sid: fixture.id, view: fixture, error: null, status: 'ready', stale: false, at: null })
    const { container } = render(<ViewChat />)
    const bubble = container.querySelector('[data-view-turn="chat.' + index + '"]')!
    expect(within(bubble as HTMLElement).getByText(first.rendered)).toBeTruthy()
    const toggle = within(bubble as HTMLElement).getByText('What these results rest on')
    toggle.click()
    expect(toggle.closest('details')!.open).toBe(true)
    expect(within(bubble as HTMLElement).getByText(first.conditions)).toBeTruthy()
  })
  it('identifies a first proposal before any model was approved', () => {
    render(<ResultReceipts claims={[{ ...first, status: 'proposed', version: 0 }]} />)
    expect(screen.getByText('Proposed model · Before first approval')).toBeTruthy()
  })
  it('leaves a legacy answer without figures unchanged', () => {
    const view = render(<ResultReceipts claims={undefined} />)
    expect(view.container.childElementCount).toBe(0)
    view.rerender(<ResultReceipts claims={[]} />)
    expect(view.container.childElementCount).toBe(0)
  })
})
