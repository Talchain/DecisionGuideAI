/**
 * SPEC-OVERNIGHT 20-21 Nov, CP-2: "What drives it (uncertain)" holds only drivers (figures); claims, left-out items, conditions, assumptions,
 * positions and other notes stand in their own row, "Points raised", folded or not.
 *
 * D7 (why the existing note fold, groups.ts approvedNote, is not enough): that fold only hides APPROVED notes on SIMPLE until someone opens the
 * row. Opening it (its own press, Show in workspace, a card's badge handing its records out) draws every note back in the inputs row under
 * "What drives it", the frame Paul read as drivers; Detailed never folds; and a non-figure card that is not kind `note` (a reported position,
 * a qualitative driver) is not folded at all. Row 0 below is that argument on an invented fixture: the notes, opened, are drawn as cards of the
 * band they stand in, so only the band can keep them apart.
 *
 * INVENTED fixture: the r5 effects View (figures, one aim, two options) with five invented non-figure cards and one invented risk.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard, ViewModel } from '../../../client'
import { BANDS, bandLabelOf, bandOf, foldsInputs, inputIdsOf } from '../bands'
import { cardGroupsOf } from '../groups'
import { bandLabelsOf } from '../BandLayer'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const base = fx.model!
const goal = base.cards.find((c) => c.family === 'goal')!
const fig = base.cards.find((c) => c.id === 'existing_capacity')!
/** An invented non-figure card in the shape core sends (no figure, no bound, approved). */
const sentence = (id: string, family: string, kind: string | null): ViewCard =>
  ({ ...goal, id, family, ...(kind === null ? {} : { kind }), heading: `Invented ${family}`, figure: null, bound: null, change: null, rows: [], headline: null } as unknown as ViewCard)
const NOTES = [sentence('inv_claim', 'claim', 'note'), sentence('inv_left', 'left_out', 'note'), sentence('inv_cond', 'condition', 'note'), sentence('inv_assume', 'assumption', 'note')]
const POSITION = sentence('inv_position', 'position', 'position')
const RISK = { ...sentence('inv_risk', 'risk', 'risk') } as ViewCard
const v2: ViewModel = { ...base, cards: [...base.cards, ...NOTES, POSITION, RISK] }
const bandsOf = (m: ViewModel, ids: readonly string[]) => ids.map((id) => bandOf(m.cards.find((c) => c.id === id)!, m))

describe('CP-2 notes stand in their own row', () => {
  it('(0) D7: the notes a fold would hide are drawn in the band they stand in once opened, so the band itself must keep them apart', () => {
    const view = { ...fx, model: v2 } as View
    const group = cardGroupsOf(v2, view).find((g) => g.kind === 'notes')!
    expect(group.cards).toEqual(NOTES.map((n) => n.id))
    // Opened, the group's cards are the board's own cards in their band: that band is what the row label names.
    expect(new Set(bandsOf(v2, group.cards))).toEqual(new Set(['points']))
  })
  it('(1) v2 shape: every note and the position in points; the figures in inputs', () => {
    expect(bandsOf(v2, [...NOTES, POSITION].map((c) => c.id))).toEqual(['points', 'points', 'points', 'points', 'points'])
    expect(bandsOf(v2, base.cards.filter((c) => c.family === 'quantity' && bandOf(c, base) === 'inputs').map((c) => c.id)).every((b) => b === 'inputs')).toBe(true)
    expect(bandOf(fig, v2)).toBe('inputs')
  })
  it('(2) v1 shape: the approved notes\' fold group is the points row\'s (group:notes:points)', () => {
    const groups = cardGroupsOf(v2, { ...fx, model: v2 } as View)
    expect(groups.filter((g) => g.kind === 'notes').map((g) => g.id)).toEqual(['group:notes:points'])
  })
  it('(3) a plain (causal) link from a note leaves it in points', () => {
    const linked: ViewModel = { ...v2, links: [...v2.links, { ...v2.links[0]!, from: 'inv_claim', to: goal.id, kind: 'plain' }] }
    expect(bandOf(linked.cards.find((c) => c.id === 'inv_claim')!, linked)).toBe('points')
  })
  it('(4) labels: the inputs row reads "What drives it (uncertain)", the points row "Points raised"; a row with no card has no label', () => {
    expect([bandLabelOf('inputs', v2), bandLabelOf('points', v2)]).toEqual([BANDS.inputs.label, 'Points raised'])
    const at = (ids: string[]) => ids.map((id, i) => ({ id, position: { x: i * 10, y: 0 } }))
    expect(bandLabelsOf(at(['existing_capacity']), v2).map((l) => l.band)).toEqual(['inputs'])
    expect(bandLabelsOf(at(['existing_capacity', 'inv_claim']), v2).map((l) => l.band).sort()).toEqual(['inputs', 'points'])
  })
  it('(5) controls: a figures-only model has no points row; options, aims and risks never go to points; the 15-driver fold counts figures only', () => {
    expect(base.cards.map((c) => bandOf(c, base)).includes('points')).toBe(false)
    expect(bandsOf(v2, ['hold', 'add_one', goal.id, 'inv_risk'])).toEqual(['options', 'options', 'aims', 'outcomes'])
    const figs = (n: number) => Array.from({ length: n }, (_, i) => ({ ...fig, id: `inv_fig_${i}` }) as ViewCard)
    const fourteen: ViewModel = { ...base, cards: [...figs(14), ...NOTES, POSITION], links: [] }
    expect([inputIdsOf(fourteen).length, foldsInputs(fourteen)]).toEqual([14, false])
    expect(foldsInputs({ ...fourteen, cards: [...fourteen.cards, ...figs(15).slice(14)] })).toBe(true)
  })
})
