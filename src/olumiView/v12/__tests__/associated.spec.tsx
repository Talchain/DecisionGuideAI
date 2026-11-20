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
import { BANDS, bandLabelOf, INPUTS_ASSOCIATED_LABEL } from '../bands/bands'
import { RestsOn, RESTS_ON } from '../cards/RestsOn'
import { isQualitative } from '../qualitativeNotes'
import { tipOf } from '../../__tests__/tipHelpers'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
afterEach(cleanup)
const claim = (id: string): ViewCard => ({ ...fx.model!.cards.find((c) => c.family === 'goal')!, id, family: 'claim', heading: id, bound: null } as unknown as ViewCard)
const aim = { ...fx.model!.cards.find((c) => c.family === 'goal')!, id: 'aim_purpose' } as ViewCard
const reason = (from: string, to: string) => ({ ...fx.model!.links[0]!, from, to, kind: 'reason' })
const qual = (links: unknown[]): ViewModel => ({ ...fx.model!, cards: [claim('claim_visitors'), claim('claim_learning'), aim], links } as unknown as ViewModel)

describe('a band of cards only associated by reasons', () => {
  it('reads "Points raised", not "What drives it"; contrast: a causal link to one of them restores the causal label', () => {
    expect(bandLabelOf('inputs', qual([reason('claim_visitors', 'aim_purpose'), reason('claim_learning', 'aim_purpose')]))).toBe(INPUTS_ASSOCIATED_LABEL)
    expect(bandLabelOf('inputs', qual([{ ...reason('claim_visitors', 'aim_purpose'), kind: 'plain' }]))).toBe(BANDS.inputs.label)
    expect(bandLabelOf('inputs', fx.model!)).toBe(BANDS.inputs.label) // the effects fixture's figures drive its outcomes
    expect(bandLabelOf('aims', qual([]))).toBe(BANDS.aims.label)
    // A figure in the band keeps the driver wording even with no causal link (a quantitative input).
    const fig = { ...fx.model!.cards.find((c) => c.family === 'quantity')! }
    expect(bandLabelOf('inputs', { ...qual([]), cards: [...qual([]).cards, fig] } as ViewModel)).toBe(BANDS.inputs.label)
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
