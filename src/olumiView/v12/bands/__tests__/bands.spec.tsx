/**
 * V12 Simple bands (lane: bands). Real path: layout.ts causalPlaces with the Simple row, on the in-repo bakery fixture (Paul's own scenarios are
 * private and never committed). Bound by card id and by test id. jsdom measures no node, so heights are given.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as coreLane from '../../../../olumiCore/lane'
import { readFileSync } from 'node:fs'
import path from 'node:path'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { cleanup, render, screen } from '@testing-library/react'
import { Position, ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import type { View, ViewCard, ViewModel } from '../../../client'
import { useViewStore } from '../../../store'
import { aimsOf, allOptionCards, causalPlaces, drawKindOf, QUESTION, questionBarWidth, simpleStageRow, SIMPLE_GAP_Y } from '../../../layout'
import { BANDS, bandLabelOf, bandOf, causalPathOf, FOLD_AT, FOLD_ID, foldsInputs, IDEA_PREFIX, inputIdsOf, unlinkedIds, withoutInputs, type BandId } from '../bands'
import { bandKindsOf, bandLabelsOf, labelsAboveFold } from '../BandLayer'
import { MODEL_GROUP_TITLE } from '../../../../canvas/domain/vocabulary'
import { extrasOf } from '../extras'
import { keptIdeasOf } from '../keptIdeas'
import { FoldCard, IdeaCard, ideaProvenance, VIEW_FOLD, VIEW_IDEA } from '../BandNodes'
import { KeyLines, KEY_MARK_IDS, keyExtrasOf, keyLinesOf, keyPresent } from '../KeyPill'
import { ICONS } from '../../../look/icons'
import { EFFECT_STROKES, INK } from '../../links/styles'
import { boardOf, drawViewCanvas, GROUP_LINK, ROOT_LINK, VIEW_LINK } from '../../../canvas'
import { useCanvasStore } from '../../../../canvas/store'
import { showSimple, showWholeModel } from '../../simpleStore'
import { tipOf } from '../../../__tests__/tipHelpers'
import { setGroupOpen, setInputsOpen } from '../foldStore'
import { groupIdOf } from '../groups'
import { GroupLinkEdge } from '../GroupLinkEdge'

/** PL 1647: the key reads the canvas's committed link edges, so a key test first commits the board the way the canvas does (drawViewCanvas over boardOf). */
const commitBoard = () => { const b = boardOf(useViewStore.getState().view!.model!); drawViewCanvas(b.model, new Map(), b.extras, b.links) }

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/model/fixtures/bakery-author.core-a62f0899.view3.json'), 'utf8')) as View
const model = view.model!
const H = 60

async function placed(m: ViewModel, extras: { id: string; band: BandId; h: number }[] = []) {
  const row = simpleStageRow(1650)
  const size = new Map([[QUESTION, { width: questionBarWidth(m, row), height: 44 }], ...m.cards.map((c) => [c.id, { width: row.cardW, height: H }] as const), ...extras.map((e) => [e.id, { width: row.cardW, height: e.h }] as const)])
  const places = await causalPlaces(m, size, { row, extras })
  return { places, y: (id: string) => places.get(id)!.y }
}

afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never) })

describe('bands: where a card stands', () => {
  it('B1 each card is in the band of its kind: options, inputs, outcomes, aims', () => {
    expect(bandOf(model.cards.find((c) => c.id === 'second_oven')!, model)).toBe('options')
    expect(bandOf(model.cards.find((c) => c.id === 'oven_price')!, model)).toBe('inputs')
    expect(bandOf(model.cards.find((c) => c.id === 'sales')!, model)).toBe('outcomes')
    expect(bandOf(model.cards.find((c) => c.id === 'oven_repair')!, model)).toBe('outcomes')
    expect(bandOf(model.cards.find((c) => c.id === 'sell_360')!, model)).toBe('aims')
    expect(bandOf(model.cards.find((c) => c.id === 'within_budget')!, model)).toBe('aims')
  })
  it('B2 the band words are the decided chrome', () => {
    expect(Object.values(BANDS).map((b) => b.label)).toEqual(['Options you could take', 'What drives it (uncertain)', 'What happens (worked out)', 'Aims', 'Points raised', 'Kept ideas'])
    expect(bandKindsOf('options', model)).toEqual(['option'])
    expect(bandKindsOf('inputs', model)).toEqual(['factor'])
    expect(bandKindsOf('outcomes', model)).toEqual(expect.arrayContaining(['outcome', 'risk']))
    expect(bandKindsOf('aims', model)).toEqual(expect.arrayContaining(['goal', 'constraint']))
    expect(bandKindsOf('ideas', model)).toEqual([])
  })
  it('B2b D5 (17 Nov): the row holding a risk is "Outcomes & risks" (the product\'s own label), never "worked out"; CONTRAST: without the risk it keeps its label', () => {
    expect(bandLabelOf('outcomes', model)).toBe(MODEL_GROUP_TITLE.outcomesRisks)
    const noRisk = { ...model, cards: model.cards.filter((c) => c.id !== 'oven_repair') }
    expect(bandLabelOf('outcomes', noRisk)).toBe(BANDS.outcomes.label)
  })
})

describe('bands: Simple layout', () => {
  it('uses the studio producer kind for members, with legacy placement only when the key is removed', async () => {
    vi.spyOn(coreLane, 'isOlumiCoreLane').mockReturnValue(true)
    const studio = JSON.parse(readFileSync(path.resolve('src/olumiView/v12/__tests__/fixtures/issue7-e499eff6-studio.view3.json'), 'utf8')) as View
    const model = studio.model!
    const members = model.cards.find((card) => card.id === 'members')!
    const absent: ViewCard = { ...members }
    delete absent.kind
    // A null kind is not in the View type; the producer can still send one, so the case is built through unknown.
    const nullKind = { ...members, kind: null } as unknown as ViewCard
    const cases: ReadonlyArray<readonly [ViewCard, Parameters<typeof bandKindsOf>[0], ReturnType<typeof drawKindOf>, string]> = [
      [members, 'outcomes', 'outcome', 'takings'],
      [absent, 'inputs', 'factor', 'class_fee'],
      [nullKind, 'points', 'factor', 'mood_members'],
    ]
    for (const [card, expectedBand, shape, peer] of cases) {
      const current: ViewModel = { ...model, cards: model.cards.map((c) => c.id === card.id ? card : c) }
      const { places } = await placed(current)
      const labels = bandLabelsOf([...places].map(([id, position]) => ({ id, position })), current)
      expect(members.kind).toBe('result')
      expect(bandOf(card, current)).toBe(expectedBand)
      expect(drawKindOf(card, current)).toBe(shape)
      expect(bandKindsOf(expectedBand, current)).toContain(shape)
      const bandTop = labels.find((label) => label.band === expectedBand)!.y
      expect(places.get(card.id)!.y).toBeGreaterThanOrEqual(bandTop)
      const next = labels.find((label) => label.y > bandTop)?.y ?? Infinity
      expect(places.get(card.id)!.y).toBeLessThan(next)
      expect(bandOf(current.cards.find((c) => c.id === peer)!, current)).toBe(expectedBand)
    }
  })

  it('B3 aims stand in a row of their own: no aim shares a row with any other card, and the aims are the lowest row', async () => {
    const { y } = await placed(model)
    const aims = aimsOf(model), others = model.cards.map((c) => c.id).filter((id) => !aims.includes(id))
    expect(aims.length).toBeGreaterThan(0)
    for (const a of aims) for (const o of others) expect(y(a), `${a} / ${o}`).not.toBe(y(o))
    for (const a of aims) for (const o of others) expect(y(a), `${a} below ${o}`).toBeGreaterThan(y(o))
  })
  it('B4 the bands read top to bottom: options, inputs, outcomes, aims', async () => {
    const { y } = await placed(model)
    const maxY = (ids: string[]) => Math.max(...ids.map(y)), minY = (ids: string[]) => Math.min(...ids.map(y))
    const of = (band: string) => model.cards.filter((c) => bandOf(c, model) === band).map((c) => c.id)
    expect(maxY(of('options'))).toBeLessThan(minY(of('inputs')))
    expect(maxY(of('inputs'))).toBeLessThan(minY(of('outcomes')))
    expect(maxY(of('outcomes'))).toBeLessThan(minY(of('aims')))
  })
  it('S4 keeps each Simple band in the same order across widths and measured heights', async () => {
    const options = ['option-a', 'option-b', 'option-c']
    // Core lists a child of C before the children of A. The crossing rule should move it after them.
    const inputs = ['c1', 'b1', 'a1', 'ab', 'c2', 'a2', 'b2', 'ac']
    const inputParents = [[2], [1], [0], [0, 1], [2], [0], [1], [0, 2]]
    const option = model.cards.find((c) => c.id === 'second_oven')!
    const input = model.cards.find((c) => c.id === 'budget')!
    const link = (from: string, to: string): ViewModel['links'][number] => ({ ...model.links[0]!, from, to, kind: 'reason' })
    const m: ViewModel = {
      ...model,
      cards: [
        ...options.map((id) => ({ ...option, id })),
        ...inputs.map((id) => ({ ...input, id })),
        model.cards.find((c) => c.id === 'within_budget')!,
        model.cards.find((c) => c.id === 'sell_360')!,
      ],
      links: [
        ...inputs.flatMap((id, i) => inputParents[i]!.map((parent) => link(options[parent]!, id))),
        link('b2', 'within_budget'),
        link('b1', 'sell_360'),
      ],
    }
    const expected = [options, ['a1', 'a2', 'ab', 'b1', 'b2', 'ac', 'c1', 'c2'], ['sell_360', 'within_budget']]
    for (const width of [600, 1000, 1232, 2000]) {
      const row = simpleStageRow(width)
      for (const variedHeights of [false, true]) {
        const size = new Map(m.cards.map((c, i) => [c.id, { width: row.cardW, height: variedHeights ? H + (i % 4) * 35 : H }] as const))
        const places = await causalPlaces(m, size, { row })
        const order = ['options', 'inputs', 'aims'].map((band) => m.cards
          .filter((c) => bandOf(c, m) === band)
          .map((c) => c.id)
          .sort((a, b) => {
            const left = places.get(a)!, right = places.get(b)!
            return left.y - right.y || left.x - right.x
          }))
        expect(order, `${width}px, varied heights: ${variedHeights}`).toEqual(expected)
      }
    }
  })
  it('B5 CHANGED BY DESIGN (Paul 17 Nov, compact centred rows): each present band has one label, over its OWN first row\'s left edge, in the 48 unit row gap (R1)', async () => {
    const { places, y } = await placed(model)
    const nodes = [...places].map(([id, position]) => ({ id, position }))
    const labels = bandLabelsOf(nodes, model)
    expect(labels.map((l) => l.band)).toEqual(['options', 'inputs', 'outcomes', 'aims'])
    // The label is anchored to the row's top (BandLayer lifts it clear of the kind marker); the room above the row is the row gap, as wide as production's.
    const topOfOptions = Math.min(...allOptionCards(model).map((c) => y(c.id)))
    expect(labels[0]!.y).toBe(topOfOptions)
    expect(topOfOptions - (places.get(QUESTION)!.y + 44), 'the label has the 48 unit row gap above the first row').toBe(SIMPLE_GAP_Y)
    // Each label's x is its band's first row's leftmost card (was one shared column at the board's left edge).
    const firstRowLeft = (band: string) => { const ids = model.cards.filter((c) => bandOf(c, model) === band).map((c) => c.id); const top = Math.min(...ids.map(y)); return Math.min(...ids.filter((id) => Math.abs(y(id) - top) <= 1).map((id) => places.get(id)!.x)) }
    for (const l of labels) expect(l.x, `${l.band} over its own row`).toBe(firstRowLeft(l.band))
    // CONTRAST: a band whose first row is narrower than the board's widest row is labelled right of the board's left edge, not at it.
    const boardLeft = Math.min(...model.cards.map((c) => places.get(c.id)!.x))
    expect(labels.some((l) => l.x > boardLeft) || labels.every((l) => l.x === boardLeft)).toBe(true)
  })
})

describe('bands: figures no link touches, and the causal path', () => {
  const lone = { ...model.cards.find((c) => c.id === 'budget')!, id: 'lone_figure', heading: 'Lone' }
  const withLone: ViewModel = { ...model, cards: [...model.cards, lone] }
  it('B6 a figure no link touches is named; a linked figure and an unlinked option are not', () => {
    // The fixture itself holds two figures no link touches (contrast: linked figures such as budget are not named).
    expect(unlinkedIds(model).sort()).toEqual(['half_capacity', 'repair_chance'])
    expect(unlinkedIds(withLone).sort()).toEqual(['half_capacity', 'lone_figure', 'repair_chance'])
  })
  it('B7 a selected card keeps its causes and effects; the others are off the path', () => {
    const path = causalPathOf(model, 'sales')!
    expect([...path].sort()).toEqual(['base_sales', 'extra_hours_sold', 'longer_hours', 'oven_repair', 'sales', 'second_oven', 'sell_360'].sort())
    expect(path.has('sales_target'), 'a sibling cause of the aim, not on the path of sales').toBe(false)
    expect(path.has('budget')).toBe(false)
    expect(path.has('carry_on')).toBe(false)
  })
  it('B8 nothing dims for the question, for no selection, or for a card with no neighbour', () => {
    expect(causalPathOf(model, null)).toBeNull()
    expect(causalPathOf(model, QUESTION)).toBeNull()
    expect(causalPathOf(withLone, 'lone_figure')).toBeNull()
  })
})

describe('bands: the key pill', () => {
  const key = (ids: string[]) => ids.map((id) => ({ id, glyph: '·', text: `core says ${id}` }))
  const withKey = (ids: string[], links: unknown[] = model.links as unknown[]): ViewModel => ({ ...model, key: key(ids), links } as ViewModel)
  it('K1 only the key items core sends are drawn, and only for a role that stands on the canvas', () => {
    // R5 (16 Nov): one predicate with the canvas: a link with a typed `causal` is a modelled effect; one with none stands as its role.
    const m = withKey(['effect', 'input', 'measures', 'olumi'], [{ ...model.links[0]!, causal: { sign: 'increases' } }, { ...model.links[1]!, role: 'measures', causal: null }])
    expect(keyLinesOf(m).map((l) => l.id)).toEqual(['effect', 'measures'])
    expect(keyLinesOf(m).map((l) => l.text)).toEqual(['core says effect', 'core says measures'])
  })
  it('K1b a link whose role says input but which carries a typed `causal` is drawn as an effect, so the key says "effect", never "input"; with no causal it is the role', () => {
    const typed = { ...model.links[0]!, role: 'input', causal: { sign: 'increases' } }, plain = { ...model.links[0]!, role: 'input', causal: null }
    expect(keyLinesOf(withKey(['effect', 'input'], [typed])).map((l) => l.id)).toEqual(['effect'])
    expect(keyLinesOf(withKey(['effect', 'input'], [plain])).map((l) => l.id)).toEqual(['input'])
  })
  it('K2 doubted and not-settled follow the links; a role core has not sent draws nothing', () => {
    const doubted = { ...model.links[0]!, doubt: true }, unsure = { ...model.links[1]!, causal: { sign: 'unknown' } }
    expect(keyLinesOf(withKey(['doubted', 'unsettled'], [doubted, unsure])).map((l) => l.id)).toEqual(['doubted', 'unsettled'])
    expect(keyLinesOf(withKey(['doubted', 'unsettled'], [model.links[0]!])).map((l) => l.id)).toEqual([])
    expect(keyLinesOf(withKey([], [{ ...model.links[0]!, causal: { sign: 'increases' } }]))).toEqual([])
  })
  it('K3 CHANGED BY DESIGN (Paul 17 Nov: one key, in the left menu): the key\'s lines and marks are two rows, samples then Olumi\'s and a person\'s marks', () => {
    const m = withKey(['effect', 'size'], [{ ...model.links[0]!, causal: { sign: 'increases' } }, { ...model.links[1]!, role: 'size', causal: null }])
    useViewStore.setState({ sid: view.id, view: { ...view, model: m }, status: 'ready' } as never); commitBoard()
    const { container } = render(<KeyLines />)
    const pill = screen.getByTestId('view-key-lines')
    expect(pill.querySelector('[data-key-row="lines"]')!.querySelectorAll('[data-key-item]')).toHaveLength(2)
    expect(container.querySelector('[data-key-item="effect"]')).toHaveTextContent('core says effect')
    expect(pill.querySelector('[data-key-row="marks"]')!.textContent).toBe("Olumi'sa person's")
  })
  it('K5 the effect sample shows polarity in the canvas\'s own tokens at 12 px, with no raw pixel size class', () => {
    const m = withKey(['effect', 'unsettled'], [
      { ...model.links[0]!, causal: { sign: 'increases' } },
      { ...model.links[1]!, causal: { sign: 'unknown' } },
      { ...model.links[2]!, doubt: false, causal: { sign: 'decreases' } },
    ])
    useViewStore.setState({ sid: view.id, view: { ...view, model: m }, status: 'ready' } as never); commitBoard()
    const { container } = render(<KeyLines />)
    const stroke = (id: string) => (container.querySelector(`[data-key-polarity="${id}"] path`) as SVGPathElement).getAttribute('stroke')
    expect(stroke('increases')).toBe(EFFECT_STROKES.increases)
    expect(stroke('decreases')).toBe(EFFECT_STROKES.decreases)
    expect(container.querySelector('[data-key-polarity="decreases"]')).toHaveTextContent('decreases')
    expect(stroke('decreases')).not.toBe(INK)
    expect(screen.getByTestId('view-key-lines').className).not.toMatch(/text-\[(9|10|11)px\]/)
    expect(screen.getByTestId('view-key-lines').className).toContain('text-[12px]')
    expect(container.querySelector('[data-key-sample="unsettled"]')!.className).toContain('text-[12px]')
  })
  it('K6 a link with core\'s `direction` is a modelled effect even with no `causal`; the doubted sample keeps both direction colours and arrows, dashed', () => {
    const typed = { ...model.links[0]!, role: 'input', causal: null, direction: 'raises', doubt: true }
    expect([...keyPresent(withKey(['effect', 'input'], [typed]))].sort()).toEqual(['doubted', 'effect'])
    const lowers = { ...model.links[1]!, causal: null, direction: 'lowers', doubt: true }
    useViewStore.setState({ sid: view.id, view: { ...view, model: withKey(['doubted'], [typed, lowers]) }, status: 'ready' } as never); commitBoard()
    const { container } = render(<KeyLines />)
    const item = container.querySelector('[data-key-item="doubted"]')!
    expect(item).toHaveTextContent('core says doubted')
    const paths = (id: string) => [...item.querySelectorAll(`[data-key-polarity="${id}"] path`)] as SVGPathElement[]
    expect(paths('increases').map((x) => x.getAttribute('stroke'))).toEqual([EFFECT_STROKES.increases, EFFECT_STROKES.increases])
    expect(paths('decreases')[0]!.getAttribute('stroke')).toBe(EFFECT_STROKES.decreases)
    expect(paths('increases')[0]!.getAttribute('stroke-dasharray')).toBe('5 4')
  })
  it('K7 the six midpoint marks, the dotted reason line and the two halos stand only where the board draws them, in registry words', () => {
    const l0 = model.links[0]!, l1 = model.links[1]!
    const cases = [{ ...l0, causal: null, direction: 'raises' }, { ...l1, causal: null, direction: 'lowers' }, { ...l1, causal: null, direction: 'depends' }, { ...l1, causal: null, direction: 'disputed' }, { ...l1, causal: null, direction: 'unknown' }, { ...l1, causal: { sign: 'none' }, direction: null }]
    const m = withKey([], cases)
    const { marks, underlays } = keyExtrasOf({ ...view, model: m } as View)
    expect([...marks].sort()).toEqual(['depends', 'disputed', 'lowers', 'none', 'raises', 'unknown'])
    expect(underlays.size).toBe(0)
    useViewStore.setState({ sid: view.id, view: { ...view, model: m }, status: 'ready' } as never); commitBoard()
    const { container } = render(<KeyLines />)
    expect(KEY_MARK_IDS).toEqual({ raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends', disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none' })
    expect([...container.querySelectorAll('[data-key-direction]')].map((e) => e.getAttribute('data-key-direction'))).toEqual(['raises', 'lowers', 'depends', 'disputed', 'unknown', 'none'])
    const words = [...container.querySelectorAll('[data-key-item="direction"]')].map((e) => e.textContent)
    expect(words).toEqual([ICONS['link-raises'].hover, ICONS['link-lowers'].hover, ICONS['link-depends'].hover, ICONS['link-none'].hover])
    cleanup()
    const none = render(<KeyLines />)
    useViewStore.setState({ sid: view.id, view: { ...view, model: withKey([], [{ ...l0, causal: null, direction: null }]) }, status: 'ready' } as never); commitBoard()
    none.rerender(<KeyLines />)
    expect(none.container.querySelector('[data-key-direction]')).toBeNull()
  })
  it('K8 the reason keeps Core’s text, a matching alert or proposal keeps its halo sample', () => {
    const reason = { ...model.links[0]!, kind: 'reason', role: 'reason', causal: null, direction: null }
    const alert = { ...model.links[1]!, causal: { sign: 'increases' }, alert: true }
    const proposed = { ...model.links[2]!, doubt: false, causal: { sign: 'increases' }, proposed: true }
    const settled = { ...view, version: { ...(view as { version?: object }).version, n: 2 }, model: { ...withKey(['reason', 'alert', 'olumi'], [reason, alert, proposed]), first_draft: false } } as View
    const x = keyExtrasOf(settled).underlays
    expect([...x].sort()).toEqual(['dotted', 'halo-alert', 'halo-proposed'])
    expect(keyExtrasOf({ ...settled, model: { ...settled.model!, first_draft: true } } as View).underlays.has('halo-proposed')).toBe(false)
    expect(keyExtrasOf({ ...settled, model: { ...settled.model!, links: [{ ...settled.model!.links[0]! }] } } as View).underlays.has('halo-alert')).toBe(false)
    useViewStore.setState({ sid: view.id, view: settled, status: 'ready' } as never); commitBoard()
    const { container } = render(<KeyLines />)
    expect(container.querySelector('[data-key-sample="dotted"]')).toBeNull()
    expect(container.querySelector('[data-key-item="dotted"]')).toHaveTextContent('core says reason')
    expect(container.querySelector('[data-key-sample="halo-alert"] path')!.getAttribute('class')).toBe('ok-link-halo ok-link-halo-alert')
    expect(container.querySelector('[data-key-sample="halo-proposed"] path')!.getAttribute('class')).toBe('ok-link-halo ok-link-halo-proposed')
    expect(container.querySelector('[data-key-item="halo-alert"]')).toHaveTextContent('core says alert')
  })
  it('K4 with no role in the View, the key still draws its marks and no line sample', () => {
    useViewStore.setState({ sid: view.id, view: { ...view, model: { ...model, key: key(['input']) } }, status: 'ready' } as never); commitBoard()
    render(<KeyLines />)
    const pill = screen.getByTestId('view-key-lines')
    expect(pill.querySelector('[data-key-row="lines"]')).toBeNull()
    expect(pill.querySelector('[data-key-item="olumi-mark"]')).not.toBeNull()
  })
})

describe('bands: kept ideas', () => {
  const items = [
    { id: 'i1', kind: 'idea', text: 'Add one line to the sign-in sheet', by_id: 'olumi', source_turn: 4, kept_by: { id: 'u1', name: 'Sam' }, status: 'live' },
    { id: 'i2', kind: 'idea', text: 'Set aside idea', by_id: 'olumi', status: 'set_aside' },
    { id: 'c1', kind: 'claim', text: 'A claim is not an idea', by_id: 'u1', status: 'live' },
  ]
  const v = { ...view, strategy: { items } } as unknown as View
  it('I1 only live ideas are read, as Olumi\'s with their keeper', () => {
    expect(keptIdeasOf(v)).toEqual([{ id: 'i1', text: 'Add one line to the sign-in sheet', olumis: true, sourceTurn: '4', keptBy: { id: 'u1', name: 'Sam' } }])
    expect(keptIdeasOf(view)).toEqual([])
  })
  it('I2 an idea card carries Olumi\'s corner mark and the provenance on hover', async () => {
    const idea = keptIdeasOf(v)[0]!
    const { container } = render(<IdeaCard {...({ data: { idea, width: 200 } } as unknown as Parameters<typeof IdeaCard>[0])} />)
    expect(container.querySelector('[data-idea-mark="olumi"]')).not.toBeNull()
    expect(await tipOf(screen.getByTestId('view-idea-card'))).toContain(ideaProvenance(idea))
    expect(ideaProvenance(idea)).toBe("Olumi's idea · kept by Sam")
  })
  it('I3 the ideas stand in their own band, last, below the aims', async () => {
    const extras = extrasOf(v, view.id, null)
    expect(extras.map((e) => e.id)).toEqual([`${IDEA_PREFIX}i1`])
    const { y } = await placed(model, extras)
    for (const id of model.cards.map((c) => c.id)) expect(y(`${IDEA_PREFIX}i1`), id).toBeGreaterThan(y(id))
  })
})

describe('bands: a kept idea is as tall as its whole text (R6: unclamped), and the layout uses the MEASURED height, not the 60 reserved', () => {
  it('I4 six ideas stand in two rows; a measured height above IDEA_H pushes the next row down by exactly that height and a gap, so nothing overlaps; CONTRAST: the reserved height does not', async () => {
    const extras = Array.from({ length: 6 }, (_, i) => ({ id: `${IDEA_PREFIX}i${i}`, band: 'ideas' as const, h: 60 }))
    const row = simpleStageRow(1650)
    const sizeOf = (h: number) => new Map([[QUESTION, { width: questionBarWidth(model, row), height: 44 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: H }] as const), ...extras.map((e) => [e.id, { width: row.cardW, height: h }] as const)])
    const tall = await causalPlaces(model, sizeOf(240), { row, extras }), reserved = await causalPlaces(model, sizeOf(60), { row, extras })
    const rowsOf = (pl: Map<string, { y: number }>) => [...new Set(extras.map((e) => pl.get(e.id)!.y))].sort((a, b) => a - b)
    const [t1, t2] = rowsOf(tall), [r1, r2] = rowsOf(reserved)
    expect(rowsOf(tall).length, 'two rows of ideas').toBe(2)
    expect([t2! - t1!, r2! - r1!], 'the second row sits one measured height and one 48 gap below the first').toEqual([240 + SIMPLE_GAP_Y, 60 + SIMPLE_GAP_Y])
  })
})

describe('bands: 15 or more inputs fold in place (rule 7)', () => {
  const input = model.cards.find((c) => c.id === 'budget')!
  const many: ViewModel = { ...model, cards: [...model.cards, ...Array.from({ length: FOLD_AT }, (_, i) => ({ ...input, id: `extra_${i}`, heading: `Extra ${i}` }))] }
  it('R1 the fold applies at 15 inputs and not at 14', () => {
    expect(inputIdsOf(model).length).toBeLessThan(FOLD_AT)
    expect(foldsInputs(model)).toBe(false)
    expect(foldsInputs(many)).toBe(true)
    expect(foldsInputs({ ...model, cards: [...model.cards, ...many.cards.filter((c) => c.id.startsWith('extra_')).slice(0, FOLD_AT - inputIdsOf(model).length - 1)] })).toBe(false)
  })
  it('R2 folded, the inputs and their links leave the drawn model; options, outcomes and aims stay', () => {
    const folded = withoutInputs(many)
    expect(inputIdsOf(folded)).toEqual([])
    expect(folded.cards.map((c) => c.id).sort()).toEqual(many.cards.filter((c) => bandOf(c, many) !== 'inputs').map((c) => c.id).sort())
    expect(folded.links.every((l) => folded.cards.some((c) => c.id === l.from) && folded.cards.some((c) => c.id === l.to))).toBe(true)
  })
  it('R3 the folded group stands in the inputs band, between the options and the outcomes, and shows the count', async () => {
    const extras = extrasOf(view, view.id, many)
    expect(extras[0]).toMatchObject({ id: FOLD_ID, band: 'inputs', data: { count: inputIdsOf(many).length } })
    const folded = withoutInputs(many)
    const { y } = await placed(folded, extras)
    expect(y(FOLD_ID)).toBeGreaterThan(Math.max(...allOptionCards(folded).map((c) => y(c.id))))
    expect(y(FOLD_ID)).toBeLessThan(Math.min(...folded.cards.filter((c) => bandOf(c, folded) === 'outcomes').map((c) => y(c.id))))
    const { container } = render(<ReactFlowProvider><FoldCard {...({ id: FOLD_ID, data: { count: 20, sid: 's', width: 200 } } as unknown as Parameters<typeof FoldCard>[0])} /></ReactFlowProvider>)
    expect(container.querySelector('[data-testid="view-inputs-fold"]')).toHaveTextContent('20 inputs')
  })
})

describe('bands: what the canvas draws (real drawViewCanvas)', () => {
  const ideaView = { ...view, strategy: { items: [{ id: 'i1', kind: 'idea', text: 'Add one line', by_id: 'olumi', kept_by: { id: 'u', name: 'Sam' }, status: 'live' }] } } as unknown as View
  const input = model.cards.find((c) => c.id === 'budget')!
  const many: ViewModel = { ...model, cards: [...model.cards, ...Array.from({ length: FOLD_AT }, (_, i) => ({ ...input, id: `extra_${i}`, heading: `Extra ${i}` }))] }
  const draw = async (core: ViewModel, v: View) => {
    useViewStore.setState({ uuid: 'u', sid: v.id, view: { ...v, model: core }, status: 'ready' } as never)
    const { model: m, extras, links } = boardOf(core)
    drawViewCanvas(m, await causalPlaces(m, new Map(), { row: simpleStageRow(1650), extras }), extras, links)
    return useCanvasStore.getState()
  }
  it('D1 Simple: the question draws no wires to the options, and a kept idea is a card in its band; Detailed keeps the wires', async () => {
    showSimple(view.id)
    const simple = await draw(model, ideaView)
    expect(simple.edges.filter((e) => e.type === ROOT_LINK)).toEqual([])
    expect(simple.nodes.find((n) => n.id === `${IDEA_PREFIX}i1`)?.type).toBe(VIEW_IDEA)
    showWholeModel(view.id)
    const detailed = await draw(model, ideaView)
    expect(detailed.edges.filter((e) => e.type === ROOT_LINK).map((e) => e.target).sort()).toEqual(allOptionCards(model).map((c) => c.id).sort())
    expect(detailed.nodes.some((n) => n.type === VIEW_IDEA)).toBe(false)
  })
  it('D2 Simple with 15 inputs: they are not drawn, the group is, and opening it draws them in place', async () => {
    showSimple(view.id)
    const closed = await draw(many, view)
    expect(closed.nodes.some((n) => n.id === 'extra_0')).toBe(false)
    expect(closed.nodes.find((n) => n.id === FOLD_ID)?.type).toBe(VIEW_FOLD)
    expect(closed.edges).toEqual(expect.arrayContaining([expect.objectContaining({ source: FOLD_ID, target: 'within_budget', type: GROUP_LINK })]))
    setInputsOpen(view.id, true)
    const open = await draw(many, view)
    expect(open.nodes.some((n) => n.id === 'extra_0')).toBe(true)
    expect(open.nodes.some((n) => n.id === FOLD_ID)).toBe(false)
    expect(open.edges.some((e) => e.source === FOLD_ID || e.target === FOLD_ID)).toBe(false)
    setInputsOpen(view.id, false)
    showWholeModel(view.id)
  })
  it('D3 one-way folded links keep their arrows, a mixed pair draws one plain line, and opening the group draws the real links', async () => {
    const members = ['budget', 'oven_price', 'fitting']
    const group = groupIdOf('proposed', 'points')
    const forward = model.links.filter((l) => members.includes(l.from))
    const reverse = { ...forward[0]!, from: 'spend', to: 'fitting', kind: 'plain' as const }
    const core = {
      ...model,
      cards: model.cards
        .filter((c) => [...members, 'spend', 'within_budget'].includes(c.id))
        .map((c) => members.includes(c.id)
          ? { ...c, kind: 'note' as const, figure: null, author: { by: 'olumi' as const, text: '', title: '' }, change: { kind: 'added' as const, glyph: '+', title: '' } }
          : { ...c, author: { by: 'person' as const, text: '', title: '' } }),
      links: [...forward, reverse],
    }
    showSimple(view.id)
    try {
      const closed = await draw(core, view)
      expect(closed.nodes.find((n) => n.id === group)?.data).toMatchObject({ count: 3 })
      const summary = closed.edges
      expect(summary.map((e) => [e.type, e.source, e.target]).sort()).toEqual([
        [GROUP_LINK, group, 'spend'], [GROUP_LINK, group, 'within_budget'],
      ])
      const incoming = (await draw({ ...core, links: [reverse] }, view)).edges.filter((e) => e.type === GROUP_LINK)
      expect(incoming.map((e) => [e.source, e.target])).toEqual([['spend', group]])

      const flowNodes: Node[] = [group, 'spend', 'within_budget'].map((id, index) => ({
        id, position: { x: 100 * index, y: 100 * index }, data: {}, width: 100, height: 40,
        handles: [
          { type: 'source', position: Position.Bottom, x: 50, y: 40 },
          { type: 'target', position: Position.Top, x: 50, y: 0 },
        ],
      }))
      const { container } = render(<ReactFlow nodes={flowNodes} edges={[...summary, ...incoming]} edgeTypes={{ [GROUP_LINK]: GroupLinkEdge }} />)
      expect(screen.getByRole('img', { name: '3 and spend: links both ways (3 links)' })).toHaveClass('react-flow__edge')
      expect(screen.getByRole('img', { name: '3 to Within the £3,000 (1 link)' })).toHaveClass('react-flow__edge')
      expect(screen.getByRole('img', { name: 'spend to 3 (1 link)' })).toHaveClass('react-flow__edge')
      const mixed = container.querySelectorAll('[data-mixed-direction]')
      expect(mixed).toHaveLength(1)
      expect(mixed[0]).toHaveAttribute('data-group-link', `group:${group}->spend`)
      expect(mixed[0]).toHaveAttribute('data-group-link-count', '3')
      expect(mixed[0]!.querySelector('.ok-link-line')).toBeInTheDocument()
      expect(mixed[0]!.querySelector('[marker-start], [marker-end], marker')).toBeNull()
      for (const id of [`group:${group}->within_budget`, `group:spend->${group}`]) {
        const edge = container.querySelector(`[data-group-link="${id}"]`)
        expect(edge?.querySelector('.ok-link-line')).toHaveAttribute('marker-end', expect.stringMatching(/^url\(#/))
      }
      setGroupOpen(view.id, group)
      const open = await draw(core, view)
      expect(open.edges.map((e) => [e.type, e.source, e.target]).sort()).toEqual(
        core.links.map((l) => [VIEW_LINK, l.from, l.to]).sort(),
      )
    } finally {
      setGroupOpen(view.id, group, false)
      showWholeModel(view.id)
    }
  })
})

describe('band label visibility at the window foot', () => {
  const height = 704
  const ls = [{ band: 'inputs', y: height - 10 }, { band: 'outcomes', y: height + 1 }]
  it('shows a label 10 px above the foot and hides one at or past it', () => {
    expect(labelsAboveFold(ls, 0, 1, height).map((l) => l.band)).toEqual(['inputs'])
    expect(labelsAboveFold(ls, -1, 1, height).map((l) => l.band)).toEqual(['inputs'])
    expect(labelsAboveFold(ls, -2, 1, height).map((l) => l.band)).toEqual(['inputs', 'outcomes'])
  })
  it('B-fold CONTRAST: before the pane is measured (height 0) every label is kept', () => {
    expect(labelsAboveFold(ls, 0, 1, 0).map((l) => l.band)).toEqual(['inputs', 'outcomes'])
  })
})
