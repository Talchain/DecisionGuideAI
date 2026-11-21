/**
 * Codex 019 (18:19Z) on the saved qualitative brief: (b) cards associated with the question only by reasons stand under a neutral band label,
 * never "What drives it", which claims a cause; (a) what a card rests on (its premises) is on the Simple face, open by default on a qualitative
 * model and closed otherwise.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard, ViewModel } from '../../client'
import { BANDS, bandLabelOf, bandOf } from '../bands/bands'
import { RestsOn, RESTS_ON } from '../cards/RestsOn'
import { isQualitative } from '../qualitativeNotes'
import { tipOf } from '../../__tests__/tipHelpers'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
afterEach(cleanup)
const claim = (id: string): ViewCard => ({ ...fx.model!.cards.find((c) => c.family === 'goal')!, id, family: 'claim', heading: id, bound: null } as unknown as ViewCard)
const aim = { ...fx.model!.cards.find((c) => c.family === 'goal')!, id: 'aim_purpose' } as ViewCard
const reason = (from: string, to: string) => ({ ...fx.model!.links[0]!, from, to, kind: 'reason' })
const qual = (links: unknown[]): ViewModel => ({ ...fx.model!, cards: [claim('claim_visitors'), claim('claim_learning'), aim], links } as unknown as ViewModel)

describe('a card that is not a figure stands under "Points raised", never "What drives it" (Codex 019; SPEC-OVERNIGHT CP-2: its own row; full rows in bands/__tests__/bandsPoints.spec.ts)', () => {
  it('CHANGED BY DESIGN (CP-2 AC3): notes go to the points band whatever their links, a causal one included; figures stay drivers; the inputs band always says "What drives it"', () => {
    const m = qual([reason('claim_visitors', 'aim_purpose'), reason('claim_learning', 'aim_purpose')])
    expect(m.cards.filter((c) => c.family === 'claim').map((c) => bandOf(c, m))).toEqual(['points', 'points'])
    // A claim is a note: a causal link does not make it a driver (Paul read notes in the drivers' row as drivers).
    const causal = qual([{ ...reason('claim_visitors', 'aim_purpose'), kind: 'plain' }])
    expect(bandOf(causal.cards[0]!, causal)).toBe('points')
    // A figure is a driver with no link at all.
    const fig = { ...fx.model!.cards.find((c) => c.family === 'quantity')! }
    const withFig = { ...qual([]), cards: [...qual([]).cards, fig] } as ViewModel
    expect(bandOf(fig, withFig)).toBe('inputs')
    expect([bandLabelOf('inputs', fx.model!), bandLabelOf('inputs', m), bandLabelOf('points', m), bandLabelOf('aims', m)]).toEqual([BANDS.inputs.label, BANDS.inputs.label, 'Points raised', BANDS.aims.label])
  })
})

describe('what a card rests on, on the Simple face', () => {
  const premises = [
    { glyph: '◇', text: 'Unchecked: more visitors means more learning.', title: 'assumption · Proposed by Olumi', id: 'assume_reach_depth', olumi: { glyph: '◆', title: 'Proposed by Olumi' } },
    { glyph: '◇', text: 'Unchecked: ownership comes from having a say.', title: 'assumption', id: 'assume_ownership', olumi: null },
  ]
  const withPremises = { ...aim, premises } as ViewCard
  it('is open on a qualitative model, every premise in core\'s words with Olumi\'s mark on Olumi\'s; closed on a model with figures, one press opens it', async () => {
    expect([isQualitative(qual([])), isQualitative(fx.model)]).toEqual([true, false])
    const open = render(<RestsOn card={withPremises} open={isQualitative(qual([]))} />)
    expect(screen.getByTestId('rests-on-aim_purpose').textContent).toBe(RESTS_ON(2))
    const items = [...screen.getByTestId('rests-on-aim_purpose-list').querySelectorAll('li')]
    // R6 (16 Nov): a premise is drawn whole and wrapped (no line-clamp), so its end is never lost.
    const said: string[] = []
    for (const li of items) said.push(await tipOf(li as HTMLElement))
    expect(items.map((li, i) => [li.querySelector('.break-words')?.textContent, said[i]])).toEqual(premises.map((p) => [p.text, p.title]))
    expect(items.every((li) => li.querySelector('[class*="line-clamp"]') === null)).toBe(true)
    expect(items.map((li) => li.querySelector('[role="img"], svg') !== null)).toEqual([true, false])
    expect(items[1]!.textContent).toBe(`${premises[1]!.glyph}${premises[1]!.text}`)
    open.unmount()
    render(<RestsOn card={withPremises} open={isQualitative(fx.model)} />)
    expect(screen.queryByTestId('rests-on-aim_purpose-list')).toBeNull()
    fireEvent.click(screen.getByTestId('rests-on-aim_purpose'))
    expect(screen.getByTestId('rests-on-aim_purpose-list').querySelectorAll('li')).toHaveLength(2)
  })
  it('draws nothing for a card that rests on nothing', () => {
    const { container } = render(<RestsOn card={{ ...aim, premises: [] } as ViewCard} open />)
    expect(container.textContent).toBe('')
  })
})
