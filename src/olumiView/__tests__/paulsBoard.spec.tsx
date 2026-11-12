/**
 * Paul's A11 board (12 Nov, his own brief, a PENDING first model; UI-15/15b): the UI faults he saw, each bound by identity. No fixture is
 * taken from his store: the pending first model here is core's own European first model held as a proposal ("new scenario",
 * reasoning/__tests__/fixtures/european-loop9.view3.json); a row that needs a shape it lacks says so and derives it from that View.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
// The chat's proposal (PB9) is mounted alone: the sign-in client it imports is not reached.
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider, useStoreApi } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { RootLinkEdge, ROOT_LINK_STROKE } from '../previous/RootLinkEdge'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'
import { HeldProposalLine } from '../ViewChances'
import { PortAnalysisTab } from '../port/PortAnalysisTab'
import { COMPARE_HELD, COMPARE_NONE, CoreCompareTab } from '../../olumiCore/compare'
import type { NodeProps } from '@xyflow/react'
import { CoreCard } from '../previous/CoreCard'
import { QUESTION } from '../layout'
import { boardKeyOf, openBadgesKeyOf } from '../camera'
import { Proposal } from '../ViewChat'
import { useViewLens, usePreMortemGate } from '../lens'
import { clearWhatIf, useWhatIf, type WhatIfAnswer } from '../whatif'
import { WHAT_IF_COPY } from '../../canvas/artefacts/whatIfCopy'

const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const ready = (view: View | null, sid: string | null = view?.id ?? null) => {
  useViewStore.setState({ uuid: sid === null ? null : '00000000-0000-4000-8000-000000000001', sid, view, status: view === null ? 'none' : 'ready', error: null, stale: false, at: null } as never)
  if (view !== null) useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const css = () => readdirSync(path.resolve('src/styles')).filter((f) => f.endsWith('.css')).map((f) => readFileSync(path.resolve('src/styles', f), 'utf8')).join('\n') + readFileSync(path.resolve('src/index.css'), 'utf8')

describe('the graph', () => {
  it('PB1 (G1): the question-to-option line is stroked with a colour the stylesheets define; the old token is defined nowhere', () => {
    const Edge = RootLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
    const c = render(<ReactFlowProvider><svg><Edge id="root:o" source="q" target="o" sourceX={0} sourceY={0} targetX={0} targetY={80} sourcePosition={Position.Bottom} targetPosition={Position.Top} /></svg></ReactFlowProvider>).container
    const stroke = c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.style.stroke
    expect(stroke).toBe(ROOT_LINK_STROKE)
    const token = /^var\((--[\w-]+)\)$/.exec(stroke)![1]!
    expect(new RegExp(`${token}:\\s*#[0-9a-fA-F]{6}\\b`).test(css()), `${token} is a hex colour in the stylesheets`).toBe(true)
    expect(/--border-strong\s*:/.test(css()), 'CONTRAST: the old token is defined nowhere').toBe(false)
  })

  it('PB2 (G4): a link into a card wholly above its source leaves the source\'s top and enters the target\'s foot; CONTRAST: a link downward keeps its handles', () => {
    const link = { ...EU.model!.links[0]!, from: 'low', to: 'high', kind: 'reason', label: '', effect: null, remove: null }
    const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
    // The question heads the board, so "high" is a middle row (a link into the head row takes a rail: linkRail.ts).
    const boxes = { q: { x: 0, y: -160, w: 548, h: 66 }, high: { x: 300, y: 0, w: 248, h: 100 }, low: { x: 0, y: 160, w: 248, h: 100 } }
    const draw = (from: 'low' | 'high', to: 'low' | 'high', sx: number, sy: number, tx: number, ty: number) => {
      const Seed = () => {
        const api = useStoreApi()
        api.setState({ nodeLookup: new Map(Object.entries(boxes).map(([id, b]) => [id, { id, selected: false, internals: { positionAbsolute: { x: b.x, y: b.y } }, measured: { width: b.w, height: b.h } }])) as never })
        return null
      }
      const c = render(<ReactFlowProvider><Seed /><EdgeLabelLayer><svg><Edge id="l0" source={from} target={to} sourceX={sx} sourceY={sy} targetX={tx} targetY={ty}
        sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: { ...link, from, to }, i: 0 }} selected /></svg></EdgeLabelLayer></ReactFlowProvider>).container
      return c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.getAttribute('d')!
    }
    // Upward: from "low" (its bottom handle at 124,260) into "high" (its top handle at 424,0), as React Flow hands them over.
    const up = draw('low', 'high', 124, 260, 424, 0)
    expect(up.startsWith('M124,160')).toBe(true) // the source card's top-centre
    expect(up.endsWith('424,100')).toBe(true) // the target card's foot, centre
    cleanup()
    const down = draw('high', 'low', 424, 100, 124, 160)
    expect([down.startsWith('M424,100'), down.endsWith('124,160')]).toEqual([true, true])
  })
})

describe('the panel on a pending first model', () => {
  it('PB3 (P3): the held proposal says core\'s heading and the version it is on apart, never run together', () => {
    ready(EU)
    const p = render(<HeldProposalLine />).container.querySelector('[data-testid="view-tabs-held-proposal"]')!
    expect(p.textContent).toBe(`${EU.proposal!.heading} · ${EU.proposal!.on}`)
  })

  it('PB4 (P3, derived: the European first model without its lead, waits or option rows, as Paul\'s first model had): the Analysis hero draws no empty box; CONTRAST: with its lead it does', () => {
    ready(EU)
    const withLead = render(<PortAnalysisTab />).container
    expect(withLead.querySelector('[data-testid="port-analysis-hero"] [data-view="run.lead"]')?.textContent).toBe(EU.model!.run!.lead)
    cleanup()
    const bare = structuredClone(EU)
    Object.assign(bare.model!.run!, { lead: null, waits_on: null, shared_blockers: null, most_likely: null })
    for (const c of bare.model!.cards) if (c.family === 'option') Object.assign(c, { rows: [], headline: null })
    ready(bare)
    expect(render(<PortAnalysisTab />).container.querySelector('[data-testid="port-analysis-hero"]')).toBeNull()
  })

  it('PB5 (P2): Compare on a first model held as Olumi\'s proposal says so, not "start a model"; CONTRAST: with no scenario it says start one', () => {
    ready(EU)
    expect(EU.version ?? null).toBeNull()
    expect(render(<CoreCompareTab />).container.querySelector('[data-testid="core-compare-none"]')?.textContent).toBe(COMPARE_HELD)
    cleanup()
    ready(null, null)
    expect(render(<CoreCompareTab />).container.querySelector('[data-testid="core-compare-none"]')?.textContent).toBe(COMPARE_NONE)
  })
})

describe('core\'s badges on the board (UI-18: the lane\'s card never drew them)', () => {
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
  type B = { label: string; face?: string; words?: string; text: string }
  const said = (b: B) => b.face ?? b.words ?? b.text

  it('PB6: the question\'s badge is drawn on the question, in core\'s words, under its own label (pending European first model)', () => {
    ready(EU)
    const b = EU.model!.question.badge as unknown as B
    expect(b, 'precondition: core folded records behind the question').not.toBeNull()
    render(<ReactFlowProvider><Node {...props(QUESTION, undefined)} /></ReactFlowProvider>)
    const btn = document.querySelector<HTMLElement>(`[data-core-badge="${QUESTION}"] button`)!
    expect([btn.getAttribute('aria-label'), btn.textContent!.includes(said(b))]).toEqual([b.label, true])
  })

  it('PB7: every card core folds records behind draws its badge, by its id, in core\'s words; a card with none draws none', () => {
    ready(EU)
    const m = EU.model!, withBadge = m.cards.filter((c) => c.badge != null)
    expect(withBadge.length).toBeGreaterThan(0)
    for (const c of m.cards) {
      const r = render(<ReactFlowProvider><Node {...props(c.id, c)} /></ReactFlowProvider>)
      const btn = r.container.querySelector<HTMLElement>(`[data-core-badge="${c.id}"] button`)
      if (c.badge == null) expect(btn, c.id).toBeNull()
      else expect([btn?.getAttribute('aria-label'), btn?.textContent?.includes(said(c.badge as unknown as B))], c.id).toEqual([(c.badge as unknown as B).label, true])
      r.unmount()
    }
  })
})

describe('the DL\'s look at A13b (12 Nov)', () => {
  it('PB8: opening or closing a badge changes the board the camera frames (the View it returned); CONTRAST: the same View keeps its key', () => {
    const m = EU.model!, carded = m.cards.find((c) => c.badge != null)!
    const key = (v: View) => `${boardKeyOf('s', v)}|${openBadgesKeyOf(v)}`
    const shut = { ...EU, model: { ...m, question: { ...m.question, badge: m.question.badge && { ...m.question.badge, open: false } }, cards: m.cards.map((c) => (c.badge == null ? c : { ...c, badge: { ...c.badge, open: false } })) } } as View
    const qOpen = { ...shut, model: { ...shut.model!, question: { ...shut.model!.question, badge: { ...shut.model!.question.badge!, open: true } } } } as View
    const cOpen = { ...shut, model: { ...shut.model!, cards: shut.model!.cards.map((c) => (c.id === carded.id ? { ...c, badge: { ...c.badge!, open: true } } : c)) } } as View
    expect(new Set([key(shut), key(qOpen), key(cOpen)]).size).toBe(3)
    expect(key({ ...shut } as View)).toBe(key(shut))
  })

  it('PB9 (the DL saw "Olumi proposes 18 changes new scenario"): the chat\'s proposal says core\'s heading and what it is on apart; both are core\'s words, unchanged', () => {
    ready(EU)
    const p = EU.proposal!
    expect(p.on, 'precondition: core says what the proposal is on').not.toBe('')
    const c = render(<Proposal p={p} busy={false} evidence={EU.evidence} />).container
    const head = c.querySelector('[data-view="proposal.heading"]')!.parentElement!
    expect(head.textContent!.startsWith(`${p.heading} · ${p.on}`)).toBe(true)
  })
})

/**
 * UI-22, the field table (the DL's sweep after UI-18): every View field the retired ViewCardNode / ViewQuestionNode drew, drawn by the lane's
 * card. Rows bind each field by its card id and its `data-view` path. Paul's own pending View (A13b, 12 Nov) carries `face.title`, `unused`,
 * `challenged`, `change` and `doubt`; the European first model has each of those too. `decide_by`, a proposed question, `committed`,
 * per-option `if_approved` and a reading have no fixture with a value: those rows are DERIVED from a fixture and say so.
 */
describe('the field table: what the retired cards drew, the lane\'s card draws', () => {
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
  const draw = (view: View, id: string) => {
    ready(view)
    const card = id === QUESTION ? undefined : view.model!.cards.find((c) => c.id === id)!
    return render(<ReactFlowProvider><Node {...props(id, card)} /></ReactFlowProvider>).container
  }
  const frame = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('*')].find((e) => e.className.includes?.('transition-[opacity,box-shadow'))!.className
  const APP = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/app-launch.view.json'), 'utf8')) as View
  type C = View['model'] extends infer M ? M extends { cards: Array<infer X> } ? X : never : never
  const withCard = (v: View, id: string, f: (c: C) => C): View => ({ ...v, model: { ...v.model!, cards: v.model!.cards.map((c) => (c.id === id ? f(c) : c)) } }) as View

  it('FT1 face.title: core\'s face title is the card\'s title where it differs from the heading; the heading stays its accessible name. CONTRAST: equal, the heading', () => {
    const m = EU.model!, diff = m.cards.find((c) => c.face?.title != null && c.face.title.text !== '' && c.face.title.text !== c.heading)!
    const same = m.cards.find((c) => c.face?.title?.text === c.heading)!
    expect(diff, 'precondition: a card whose face title differs').toBeDefined()
    expect(draw(EU, diff.id).querySelector('[data-testid="node-title"]')!.textContent).toContain(diff.face!.title!.text)
    cleanup()
    expect(draw(EU, same.id).querySelector('[data-testid="node-title"]')!.textContent).toContain(same.heading)
  })

  it('FT2 doubt / change / challenged: dashed only where core doubts it, Olumi\'s blue where proposed, orange where challenged', () => {
    const m = EU.model!
    const doubtful = m.cards.find((c) => c.doubt && c.change != null && !c.challenged)!, plain = m.cards.find((c) => !c.doubt && c.change != null && !c.challenged)!
    const chal = m.cards.find((c) => c.challenged)!
    const f1 = frame(draw(EU, doubtful.id)); cleanup()
    const f2 = frame(draw(EU, plain.id)); cleanup()
    const f3 = frame(draw(EU, chal.id))
    expect([f1.includes('border-dashed'), f1.includes('border-info')]).toEqual([true, true])
    expect([f2.includes('border-dashed'), f2.includes('border-info')], 'a proposed card core does not doubt is solid').toEqual([false, true])
    expect([f3.includes('border-[var(--olumi-mark-orange)]'), f3.includes('border-dashed')]).toEqual([true, chal.doubt])
  })

  it('FT3 change: core\'s change mark on every changed card, its words as hover and accessible name', () => {
    for (const c of EU.model!.cards) {
      const el = draw(EU, c.id).querySelector<HTMLElement>(`[data-view="${c.id}.change.glyph"]`)
      expect([el?.textContent, el?.getAttribute('aria-label'), el?.title], c.id).toEqual(c.change == null ? [undefined, undefined, undefined] : [c.change.glyph, c.change.title, c.change.title])
      cleanup()
    }
  })

  it('FT4 unused: core\'s honesty line under the figure, in core\'s words; a card without one draws none', () => {
    for (const v of [EU, APP]) for (const c of v.model!.cards) {
      const el = draw(v, c.id).querySelector(`[data-view="${c.id}.unused"]`)
      expect(el?.textContent ?? null, c.id).toBe(c.unused == null || c.unused === '' ? null : c.unused)
      cleanup()
    }
  })

  it('FT5 (DERIVED: the European question given a date Olumi set, and held as proposed): its date with core\'s hover in Olumi\'s blue, a solid blue frame. CONTRAST: none, nothing', () => {
    const q = EU.model!.question
    const dated = { ...EU, model: { ...EU.model!, question: { ...q, proposed: true, decide_by: { text: 'by 1 March', title: 'Olumi\'s reading of your brief', olumi: true } } } } as View
    const c = draw(dated, QUESTION), el = c.querySelector<HTMLElement>('[data-view="question.decide_by.text"]')!
    expect([el.textContent, el.title, el.className.includes('text-info')]).toEqual(['by 1 March', 'Olumi\'s reading of your brief', true])
    expect([frame(c).includes('border-info'), frame(c).includes('border-dashed')]).toEqual([true, false])
    cleanup()
    expect(draw(EU, QUESTION).querySelector('[data-view="question.decide_by.text"]')).toBeNull()
  })

  it('FT6 (DERIVED: committed, a per-option value core marks if approved, a reading): each drawn by its path in core\'s words', () => {
    const opt = APP.model!.cards.find((c) => c.family === 'option')!, per = APP.model!.cards.find((c) => (c.values?.length ?? 0) > 1)!
    const aim = APP.model!.cards.find((c) => c.family === 'goal')!
    let v = withCard(APP, opt.id, (c) => ({ ...c, committed: { by: 'Paul', at: '12 Nov 2026' } }))
    v = withCard(v, per.id, (c) => ({ ...c, values: c.values!.map((x, i) => (i === 0 ? { ...x, if_approved: { glyph: '↻', title: 'if approved; now 2 weeks' } } : x)) }))
    v = { ...v, model: { ...v.model!, run: { ...v.model!.run!, readings: [{ aim_id: aim.id, text: 'Reached in 2 of 3 windows', source: 'proposal' }] } } } as View
    expect(draw(v, opt.id).querySelector('[data-view$=".committed.by"]')?.textContent).toBe('Paul'); cleanup()
    const mark = draw(v, per.id).querySelector<HTMLElement>(`[data-view="${per.id}.values.0.if_approved.glyph"]`)!
    expect([mark.textContent, mark.getAttribute('aria-label')]).toEqual(['↻', 'if approved; now 2 weeks'])
    expect(document.querySelector(`[data-view="${per.id}.values.1.if_approved.glyph"]`), 'CONTRAST: a value core does not mark').toBeNull(); cleanup()
    const r = draw(v, aim.id).querySelector<HTMLElement>(`[data-view="${aim.id}.reading"]`)!
    expect([r.textContent, r.className.includes('text-info')]).toEqual(['Reached in 2 of 3 windows', true])
  })

  it('FT10 (DL-183, "a stray pencil glyph on a row of its own"): the ✎ is on the figure\'s line; on Olumi\'s question with no value yet, at the end of its author line; never a row of its own', () => {
    const studio = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/studio.view.json'), 'utf8')) as View
    const asked = studio.model!.cards.find((c) => c.figure?.edit != null && c.figure.text === '' && c.author?.by === 'olumi')!
    const sized = studio.model!.cards.find((c) => c.figure?.edit != null && c.figure.text !== '' && c.family === 'quantity' && (c.values?.length ?? 0) <= 1)!
    expect([asked, sized].every(Boolean), 'precondition').toBe(true)
    const a = draw(studio, asked.id)
    expect(a.querySelector('[data-figure-edit-wrap]')!.closest(`[data-core-author="${asked.id}"]`), asked.id).not.toBeNull(); cleanup()
    const b = draw(studio, sized.id)
    expect(b.querySelector('[data-figure-edit-wrap]')!.closest(`[data-core-lead="${sized.id}"]`), sized.id).not.toBeNull()
  })

  it('FT11 (DL, A13d: "+" on a row of its own on every pending card): core\'s change mark ends a line the card already draws, never a row of its own', () => {
    for (const c of EU.model!.cards.filter((x) => x.change != null)) {
      const el = draw(EU, c.id).querySelector<HTMLElement>(`[data-view="${c.id}.change.glyph"]`)!
      expect(el.closest('[data-core-author], [data-core-lead], [data-core-badge]'), c.id).not.toBeNull()
      cleanup()
    }
  })

  it('FT7 the opened card\'s words (a person\'s author, a route\'s own line, status, reason) are the card\'s hover, never a line on its face', () => {
    const person = EU.model!.cards.find((c) => c.author != null && c.author.by !== 'olumi' && c.author.text !== '')!
    const body = draw(EU, person.id).querySelector<HTMLElement>(`[data-core-card="${person.id}"]`)!
    expect(body.title).toContain(person.author!.text)
    expect(body.textContent, 'not on the face').not.toContain(person.author!.text)
  })
})

describe('the field table, on the lenses: If it failed and What if on the lane\'s card', () => {
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
  const V11 = path.resolve('src/olumiView/fixtures/v11')
  const CHAIN = JSON.parse(readFileSync(path.join(V11, 'consulting-chain.view3.json'), 'utf8')) as View
  const ANSWER = JSON.parse(readFileSync(path.join(V11, 'consulting-whatif-priya.json'), 'utf8')) as WhatIfAnswer
  const Q = 'diagnostic_time_to_contract', TYPED = '6 to 12 months'
  const draw = (view: View, id: string) => {
    ready(view)
    return render(<ReactFlowProvider><Node {...props(id, view.model!.cards.find((c) => c.id === id))} /></ReactFlowProvider>).container
  }
  afterEach(() => { clearWhatIf(); useViewLens.setState({ lens: 'full' }); usePreMortemGate.setState({ text: '', said: null }) })

  it('FT8 (DERIVED: one Olumi failure story on the European budget card, the pre-mortem open): the card it rests on carries core\'s mark and story; every other card recedes. CONTRAST: lens off, none recedes', () => {
    const m = EU.model!, on = m.cards[1]!, other = m.cards[2]!
    const story = { n: 1, title: 'The budget ran out before the second country', olumi: { glyph: '◆', title: 'Olumi\'s story' } }
    const v = { ...EU, session: { ...(EU.session ?? {}), pre_mortem: { state: 'open' } }, model: { ...m, cards: m.cards.map((c) => (c.id === on.id ? { ...c, failed: [story] } : c)) } } as unknown as View
    useViewLens.setState({ lens: 'premortem' })
    const a = draw(v, on.id), mark = a.querySelector<HTMLElement>(`[data-failed="${on.id}.1"]`)!
    expect([mark.textContent, mark.getAttribute('aria-label')]).toEqual(['◆1', 'Olumi\'s story · The budget ran out before the second country'])
    expect(a.querySelector('[data-premortem]')!.getAttribute('data-premortem')).toBe('rests'); cleanup()
    expect(draw(v, other.id).querySelector('[data-premortem]')!.className).toContain('opacity-40'); cleanup()
    useViewLens.setState({ lens: 'full' })
    expect(draw(v, other.id).querySelector('[data-premortem]')).toBeNull()
  })

  it('FT9 (core\'s real what-if answer, consulting-chain v18): the card tried says the figure as typed with the way back; each option its try chance in core\'s words. CONTRAST: no try, neither', () => {
    const variant = ANSWER.variants[0]!
    useWhatIf.setState({ shown: { sid: CHAIN.id, base: CHAIN.model!.edit_base, quantity: Q, typed: TYPED, variant } } as never)
    const tried = draw(CHAIN, Q).querySelector<HTMLElement>(`[data-card-try="${Q}"]`)!
    expect(tried.textContent).toContain(WHAT_IF_COPY.trying(TYPED))
    expect(tried.querySelector(`[data-testid="card-try-back-${Q}"]`)!.textContent).toBe(WHAT_IF_COPY.back(CHAIN.version?.n ?? null)); cleanup()
    const o = variant.rows[0]!, row = o.rows.find((r) => r.kind === 'chance') as { value: string }
    expect(draw(CHAIN, o.option_id).querySelector(`[data-view="whatif.${o.option_id}.chance"]`)!.textContent).toBe(row.value); cleanup()
    clearWhatIf()
    const none = draw(CHAIN, Q)
    expect([none.querySelector('[data-card-try]'), none.querySelector('[data-option-try]')]).toEqual([null, null])
  })
})
