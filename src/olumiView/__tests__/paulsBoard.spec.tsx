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
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { Position, ReactFlowProvider, useStoreApi } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { hoverWords, tipOf } from './tipHelpers'
import { useMe } from '../../olumiCore/me'
import * as coreLane from '../../olumiCore/lane'
import { RootLinkEdge } from '../previous/RootLinkEdge'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'
import { HeldProposalLine } from '../ViewChances'
import { PortAnalysisTab } from '../port/PortAnalysisTab'
import { REASONING_LABELS } from '../ViewReasoning'
import { COMMITMENT_WORDS, displayedDissent } from '../reasoning/TowardsCommitment'
import { actionable, examineOf } from '../reasoning/examine'
import { COMPARE_HELD, COMPARE_NONE, CoreCompareTab } from '../../olumiCore/compare'
import type { NodeProps } from '@xyflow/react'
import { CoreCard, leadLineOf } from '../previous/CoreCard'
import { useCanvasStore } from '../../canvas/store'
import { NODE_BODY_BOUND_STYLE_ATTR } from '../../canvas/utils/zoomLegibility'
import { VIEW_QUESTION } from '../canvas'
import { QUESTION } from '../layout'
import { boardKeyOf, openBadgesKeyOf } from '../camera'
import { setLevel, useSimpleLevel } from '../v12/simpleStore'
import { railOf } from '../../canvas/edges/linkRail'
import { frameDue, FRAME_WAIT_MS, REVEAL_MS } from '../ViewCanvas'
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
    expect(c.querySelector('path.react-flow__edge-path')).toHaveClass('ok-root-link')
    const look = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    const token = /\.ok-root-link \{ stroke: var\((--edge-neutral)\); stroke-width: 1px;/.exec(look)?.[1]
    expect(token).toBe('--edge-neutral')
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

  it('PB4 (P3, redesign 18 Nov): on the pending first model no option has a chance, so the Analysis tab draws no chart and no lead, and says what a result needs; CONTRAST: with nothing to say it draws no empty section', () => {
    ready(EU)
    const withNeeds = render(<PortAnalysisTab />).container
    expect(withNeeds.querySelector('[data-testid="port-analysis-tab"]')!.getAttribute('data-analysis-state')).toBe('none')
    expect(withNeeds.querySelector('[data-testid="analysis-chance-chart"]')).toBeNull()
    expect(withNeeds.querySelector('[data-view="run.lead"]')).toBeNull()
    expect(withNeeds.querySelector('[data-testid="analysis-needs"]')).not.toBeNull()
    cleanup()
    const bare = structuredClone(EU)
    Object.assign(bare.model!.run!, { lead: null, waits_on: null, shared_blockers: null, most_likely: null, notes: [], compared: [] })
    for (const c of bare.model!.cards) { if (c.family === 'option') Object.assign(c, { rows: [], headline: null }); if (c.figure != null) Object.assign(c, { figure: { ...c.figure, edit: null } }) }
    ready(bare)
    const empty = render(<PortAnalysisTab />).container
    expect(empty.querySelector('[data-testid="analysis-needs"]')).toBeNull()
    expect(empty.querySelectorAll('section')).toHaveLength(0)
    const dissent = bare.collab.dissent ?? []
    const items = examineOf(bare.model!, bare.session?.methods ?? null, (bare.model_words ?? null) as Record<string, unknown> | null, new Set(dissent.map((d) => d.id)))
    const examine = items.some(actionable)
    const rows = empty.querySelectorAll<HTMLButtonElement>('button[data-testid="analysis-to-reasoning"]')
    expect(rows).toHaveLength(examine || dissent.some(displayedDissent) ? 1 : 0)
    if (rows.length > 0) {
      expect(rows[0]!).toHaveTextContent(examine ? REASONING_LABELS.examine : COMMITMENT_WORDS.heading)
      expect(rows[0]!.querySelector('[data-count]')?.textContent ?? null).toBe(examine ? String(items.length) : null)
      expect(rows[0]!.querySelector('[data-view], [data-view-words]')).toBeNull()
    }
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

  it('PB6: the question\'s badge is drawn on the question, in core\'s words, under its own label (pending European first model)', async () => {
    ready(EU)
    const b = EU.model!.question.badge as unknown as B
    expect(b, 'precondition: core folded records behind the question').not.toBeNull()
    render(<ReactFlowProvider><Node {...props(QUESTION, undefined)} /></ReactFlowProvider>)
    // CHANGED BY DESIGN (Detailed, 18 Nov, two reviews): the fold is a stack mark and CORE'S OWN words for it (its face, else its text), never a count made in the page; on this
    // pending model every fold holds proposed additions, so core's change marker is drawn after the words, leads the hover and ends the name.
    const btn = document.querySelector<HTMLElement>(`button[data-core-badge="${QUESTION}"]`)!
    expect([btn.getAttribute('aria-label'), (await hoverWords(btn))?.split('\n')[0], btn.textContent, btn.querySelector('[data-view="question.badge.face"]')?.textContent, btn.querySelector('[data-view="question.badge.change"]')?.textContent])
      .toEqual(['Show 5 notes behind this, 5 proposed changes +', '+ 1 thing left out, 2 figures, 2 claims', '2 figures and 3 more+', '2 figures and 3 more', '+'])
  })

  it('PB7: every card core folds records behind draws its badge, by its id, in core\'s words; a card with none draws none', async () => {
    ready(EU)
    const m = EU.model!, withBadge = m.cards.filter((c) => c.badge != null)
    const DRAWN: Readonly<Record<string, readonly [string, string, string]>> = {
      monthly_churn: ['Show 1 notes behind this, 1 proposed changes +', '+ 1 claim', '1 claim+'],
      investment_budget: ['Show 1 notes behind this, 1 proposed changes +', '+ 1 challenge', '1 challenge+'],
      expand_into_the_european_market_in_the_next_6_12_months: ['Show 6 notes behind this, 6 proposed changes +', '+ 2 figures, 2 claims, 2 challenges', '2 figures and 4 more+'],
      pilot_in_one_european_country_first_then_widen: ['Show 2 notes behind this, 2 proposed changes +', '+ 2 figures', '2 figures+'],
      monthly_churn_2: ['Show 5 notes behind this, 5 proposed changes +', '+ 4 figures, 1 calculation', '4 figures, 1 calculation+'],
      keep_monthly_churn_from_going_beyond_12: ['Show 2 notes behind this, 2 proposed changes +', '+ 2 claims', '2 claims+'],
    }
    expect(withBadge.map((c) => c.id).sort()).toEqual(Object.keys(DRAWN).sort())
    for (const c of m.cards) {
      const r = render(<ReactFlowProvider><Node {...props(c.id, c)} /></ReactFlowProvider>)
      // CHANGED BY DESIGN (Detailed, 18 Nov, two reviews): core's own words for the fold (its face) and its change marker, by card id: the name, the hover's first line, what is drawn.
      const btn = r.container.querySelector<HTMLElement>(`button[data-core-badge="${c.id}"]`)
      if (c.badge == null) expect([btn, c.id in DRAWN], c.id).toEqual([null, false])
      else expect([btn?.getAttribute('aria-label'), btn === null ? undefined : (await hoverWords(btn))?.split('\n')[0], btn?.textContent], c.id).toEqual(DRAWN[c.id])
      r.unmount()
    }
  })
})

describe('what core folded is content, shown at rest (Codex H07 17:12Z)', () => {
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
  it.each(['simple', 'working'] as const)('DL-REQ-2240: the selected question keeps its action rail inside the frame at %s', (level) => {
    const lane = vi.spyOn(coreLane, 'isOlumiCoreLane').mockReturnValue(true)
    const previousLevelState = useSimpleLevel.getState()
    try {
      ready(EU)
      useSimpleLevel.setState({ levels: { ...previousLevelState.levels, [EU.id]: level } })
      const option = EU.model!.cards.find((card) => card.family === 'option')!
      const goal = EU.model!.cards.find((card) => card.family === 'goal')!
      const { container } = render(<ReactFlowProvider>
        <Node {...props(QUESTION, undefined)} type={VIEW_QUESTION} data={{ question: EU.model!.question }} selected />
        <Node {...props(option.id, option)} />
        <Node {...props(goal.id, goal)} selected />
      </ReactFlowProvider>)
      const board = within(container)
      const rail = board.getByTestId(`node-card-rail-${QUESTION}`)
      expect(rail).toHaveAttribute('data-rail-placement', 'inset')
      // jsdom has no layout. Pin the positioned frame and the rail's inset offsets.
      const frame = rail.closest<HTMLElement>('.ok-card-frame')!
      expect(frame).toHaveClass('relative')
      expect(rail).toHaveClass('absolute', 'bottom-[6px]', 'right-[6px]')
      const body = within(frame).getByTestId('anchor-body-rail-beside')
      const reserve = JSON.parse(body.getAttribute(NODE_BODY_BOUND_STYLE_ATTR) ?? 'null')
      expect(body.style.minHeight).toMatch(/var\(--canvas-glyph-scale, 1\)/)
      expect(body.style.minHeight).toBe(reserve.minHeight)
      expect(body.style.getPropertyValue('--ok-anchor-rail-padding')).toBe(reserve.paddingRight)
      if (level === 'simple') {
        expect(body.style.paddingRight).toBe(reserve.paddingRight)
        expect(board.getByTestId(`node-card-rail-${option.id}`)).toHaveAttribute('data-rail-placement', 'below')
        expect(board.getByTestId(`node-card-rail-${goal.id}`)).toHaveAttribute('data-rail-placement', 'below')
      }
    } finally {
      cleanup()
      useSimpleLevel.setState(previousLevelState)
      lane.mockRestore()
    }
  })
  it('PB7b: no badge line is a hover-only action, on a card or on the question; and the Simple question pill draws its notes badge', () => {
    ready(EU)
    for (const level of ['working', 'simple'] as const) {
      setLevel(level, useViewStore.getState().sid)
      const q = render(<ReactFlowProvider><Node {...props(QUESTION, undefined)} /></ReactFlowProvider>)
      const line = q.container.querySelector(`[data-core-badge="${QUESTION}"]`)
      expect(line, level).not.toBeNull()
      expect(line!.closest('[data-card-action]'), level).toBeNull()
      q.unmount()
      const c = EU.model!.cards.find((x) => x.badge != null)!
      const r = render(<ReactFlowProvider><Node {...props(c.id, c)} /></ReactFlowProvider>)
      expect(r.container.querySelector(`[data-core-badge="${c.id}"]`)!.closest('[data-card-action]'), `${level} ${c.id}`).toBeNull()
      r.unmount()
    }
    setLevel('working', useViewStore.getState().sid)
  })
  it('PB7c: on a qualitative model a Simple card draws what it rests on, open (Codex 019); on a model with figures it draws no extra line', () => {
    const withP = EU.model!.cards.find((c) => (c.premises ?? []).length > 0)!
    expect(withP, 'precondition: the European model holds a card with premises').toBeDefined()
    ready(EU)
    setLevel('simple', useViewStore.getState().sid)
    const numeric = render(<ReactFlowProvider><Node {...props(withP.id, withP)} /></ReactFlowProvider>)
    expect(numeric.container.querySelector('[data-rests-on-card]')).toBeNull()
    numeric.unmount()
    const aim = { ...EU.model!.cards.find((c) => c.family === 'goal')!, premises: withP.premises }
    ready({ ...EU, model: { ...EU.model!, cards: [aim], links: [] } } as View)
    setLevel('simple', useViewStore.getState().sid)
    const q = render(<ReactFlowProvider><Node {...props(aim.id, aim)} /></ReactFlowProvider>)
    expect(q.container.querySelector(`[data-testid="rests-on-${aim.id}"]`)?.textContent).toBe(`Rests on ${withP.premises!.length}`)
    expect(q.container.querySelectorAll(`[data-testid="rests-on-${aim.id}-list"] li`)).toHaveLength(withP.premises!.length)
    q.unmount()
    setLevel('working', useViewStore.getState().sid)
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
    const doubtful = m.cards.find((c) => c.doubt && c.change != null && !c.challenged)!, plain = m.cards.find((c) => !c.doubt && c.change != null && !c.challenged && c.author?.by !== 'olumi')!
    const olumis = m.cards.find((c) => !c.doubt && c.change != null && !c.challenged && c.author?.by === 'olumi')!
    const chal = m.cards.find((c) => c.challenged)!
    // R3 (16 Nov): this fixture is a FIRST DRAFT (a proposal, no approved version), where nothing is marked for being proposed; the approved model carries the marks.
    expect([EU.proposal != null, EU.version], 'precondition: the fixture is a first draft').toEqual([true, null])
    const APPROVED = { ...EU, proposal: null, version: { id: 1, n: 1, label: 'Version 1', changed: [], at: '2026-11-02T00:00:00.000Z', at_text: '2 Nov 2026' } } as unknown as View
    const d1 = frame(draw(EU, doubtful.id)); cleanup()
    const d2 = frame(draw(EU, plain.id)); cleanup()
    const d4 = frame(draw(EU, olumis.id)); cleanup()
    expect([d1.includes('border-dashed'), d1.includes('border-info')], 'a doubted card on a first draft: dashed in its kind\'s hue, never blue').toEqual([true, false])
    expect([d2.includes('border-dashed'), d2.includes('border-info')], 'a proposed card on a first draft: solid, not blue').toEqual([false, false])
    expect([d4.includes('border-dashed'), d4.includes('border-info')], 'Olumi\'s proposed card on a first draft: solid, not blue, not dashed').toEqual([false, false])
    const f1 = frame(draw(APPROVED, doubtful.id)); cleanup()
    const f2 = frame(draw(APPROVED, plain.id)); cleanup()
    const f3 = frame(draw(EU, chal.id))
    expect([f1.includes('border-dashed'), f1.includes('border-info')]).toEqual([true, true])
    expect([f2.includes('border-dashed'), f2.includes('border-info')], 'the person\'s own proposed card is solid').toEqual([false, true])
    cleanup()
    const f4 = frame(draw(APPROVED, olumis.id))
    expect([f4.includes('border-dashed'), f4.includes('border-info')], 'DL ruling 12 Nov: Olumi\'s proposed card is provisional, dashed (inside an approved model)').toEqual([true, true])
    // On this first draft only core's own doubt dashes (R3: a proposal is not a mark).
    expect([f3.includes('border-[var(--olumi-mark-orange)]'), f3.includes('border-dashed')]).toEqual([true, chal.doubt])
  })

  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences, text as icons with a hover; v12/detailed): an added card's "+" repeats its proposed frame,
  // so Detailed marks only a change the frame does not say (as Simple does); a changed card keeps core's glyph, its words its hover and name.
  it('FT3 change: core\'s change mark on every card changed in a way its frame does not say, its words as hover and accessible name; an addition draws none', async () => {
    const changed = EU.model!.cards.find((c) => c.change != null)!
    const v = withCard(EU, changed.id, (c) => ({ ...c, change: { glyph: '↻', title: 'An invented change', kind: 'changed' } }))
    for (const c of v.model!.cards) {
      const el = draw(v, c.id).querySelector<HTMLElement>(`[data-view="${c.id}.change.glyph"]`)
      // CHANGED BY DESIGN (panel system round 3): the hover is the one Tip, not a native `title`; the words are read through it.
      expect([el?.textContent, el?.getAttribute('aria-label'), el === null || el === undefined ? undefined : await hoverWords(el)], c.id).toEqual(c.change == null || c.change.kind === 'added' ? [undefined, undefined, undefined] : [c.change.glyph, c.change.title, c.change.title])
      cleanup()
    }
    expect(EU.model!.cards.some((c) => c.change?.kind === 'added'), 'CONTRAST: the served board has additions, drawn by their frame').toBe(true)
  })

  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences, text as icons with a hover; v12/detailed): core's honesty line is a mark at the card's foot,
  // core's words its name and hover.
  it('FT4 unused: core\'s honesty mark at the foot, named by core\'s words; a card without one draws none', () => {
    for (const v of [EU, APP]) for (const c of v.model!.cards) {
      const el = draw(v, c.id).querySelector(`[data-view="${c.id}.unused"] [role="img"]`)
      expect(el?.getAttribute('aria-label') ?? null, c.id).toBe(c.unused == null || c.unused === '' ? null : c.unused)
      cleanup()
    }
  })

  it('FT5 (DERIVED: the European question given a date Olumi set, and held as proposed): its date with core\'s hover in Olumi\'s blue, a solid blue frame. CONTRAST: none, nothing', async () => {
    const q = EU.model!.question
    // Inside an approved model (R3: on a first draft the question is not marked as proposed either).
    const dated = { ...EU, proposal: null, version: { id: 1, n: 1, label: 'Version 1', changed: [], at: '2026-11-02T00:00:00.000Z', at_text: '2 Nov 2026' }, model: { ...EU.model!, question: { ...q, proposed: true, decide_by: { text: 'by 1 March', title: 'Olumi\'s reading of your brief', olumi: true } } } } as unknown as View
    const c = draw(dated, QUESTION), el = c.querySelector<HTMLElement>('[data-view="question.decide_by.text"]')!
    // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences, text as icons with a hover; v12/detailed): the date is a calendar mark and core's words; Olumi's blue is the look's class.
    expect([el.textContent, await hoverWords(el), el.className.includes('ok-dt-olumi')]).toEqual(['by 1 March', 'Olumi\'s reading of your brief', true])
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
    // DL-529: Olumi's blue is the look's own class (olumiLook.css `ok-by-olumi`, --o-info).
    expect([r.textContent, r.className.includes('ok-by-olumi')]).toEqual(['Reached in 2 of 3 windows', true])
  })

  it('FT10 (DL-183, "a stray pencil glyph on a row of its own"): the ✎ is on the figure\'s line; on Olumi\'s question with no value yet, at the end of its author line; never a row of its own', () => {
    const studio = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/studio.view.json'), 'utf8')) as View
    const asked = studio.model!.cards.find((c) => c.figure?.edit != null && c.figure.text === '' && c.author?.by === 'olumi')!
    const sized = studio.model!.cards.find((c) => c.figure?.edit != null && c.figure.text !== '' && c.family === 'quantity' && (c.values?.length ?? 0) <= 1)!
    expect([asked, sized].every(Boolean), 'precondition').toBe(true)
    // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences, text as icons with a hover; v12/detailed): with no author line, the ✎ of Olumi's question with
    // no value yet sits on the card's foot row of marks, never a row of its own.
    const a = draw(studio, asked.id)
    expect(a.querySelector('[data-figure-edit-wrap]')!.closest('.ok-dt-foot'), asked.id).not.toBeNull(); cleanup()
    const b = draw(studio, sized.id)
    expect(b.querySelector('[data-figure-edit-wrap]')!.closest(`[data-core-lead="${sized.id}"]`), sized.id).not.toBeNull()
  })

  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences, text as icons with a hover; v12/detailed): a change the frame does not say sits on the foot's
  // row of marks (never a row of its own); an addition draws none (its proposed frame says it).
  it('FT11 (DL, A13d: "+" on a row of its own on every pending card): core\'s change mark sits on the foot\'s row of marks, never a row of its own; an addition draws none', () => {
    const c = EU.model!.cards.find((x) => x.change != null)!
    const v = withCard(EU, c.id, (x) => ({ ...x, change: { glyph: '↻', title: 'An invented change', kind: 'changed' } }))
    expect(draw(v, c.id).querySelector<HTMLElement>(`[data-view="${c.id}.change.glyph"]`)!.closest('.ok-dt-foot'), c.id).not.toBeNull(); cleanup()
    for (const x of EU.model!.cards.filter((y) => y.change?.kind === 'added')) { expect(draw(EU, x.id).querySelector(`[data-view="${x.id}.change.glyph"]`), x.id).toBeNull(); cleanup() }
  })

  it('FT12 (live draft, 12 Nov: "No changes specified" on options zoomed out): a core card with no far line of core\'s draws none, never the previous product\'s; CONTRAST: one with a line draws it', () => {
    const opt = EU.model!.cards.find((c) => c.family === 'option')!
    const bare = withCard(EU, opt.id, (c) => ({ ...c, headline: null, rows: [] }))
    const zoomedOut = (v: View) => { ready(v); return render(<ReactFlowProvider><Node {...props(opt.id, v.model!.cards.find((c) => c.id === opt.id))} /></ReactFlowProvider>).container }
    const was = useCanvasStore.getState().lodRung
    useCanvasStore.setState({ lodRung: 'line' } as never)
    try {
      expect(zoomedOut(bare).textContent).not.toContain('No changes specified'); cleanup()
      // The CONTRAST is a SERVED chance (state 'chance'): contract 3 (15 Nov) draws core's why for a withheld one (state 'none'), as this card is in EU.
      const lead = leadLineOf(EU.model!.cards.find((c) => c.id === opt.id)!) ?? 'about'
      expect(zoomedOut(withCard(EU, opt.id, (c) => ({ ...c, headline: { ...(c.headline ?? { title: '', shared: false, aim_id: null }), state: 'chance', text: 'about 41% chance' } as never }))).textContent, 'CONTRAST').toContain('about 41% chance')
      void lead
    } finally { useCanvasStore.setState({ lodRung: was } as never) }
  })

  // ORDER-UI-NEXT (DL, 13 Nov): three lines, as every other card: at two, the chance line's assumption name was cut ("…for 'Weeks until first…").
  // DL 15 Nov polish (supersedes the three-line clamp of FT13/FT14): no sentence is ever cut on a card face; core's words are drawn whole, wrapped.
  it('FT13 an option\'s long setting question is drawn whole on its face, never cut; core\'s words whole on hover too', async () => {
    const opt = EU.model!.cards.find((c) => c.family === 'option')!
    const long = 'How much would "Close 1.3 million now and plan a follow-on tied to milestones" change "Follow-on funding planned against milestones", and in what unit is it counted?'
    const v = withCard(EU, opt.id, (c) => ({ ...c, headline: null, rows: [{ kind: 'none', aim_id: null, text: long, title: 'core\'s title' } as never] }))
    // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences, text as icons with a hover; v12/detailed): a sentence longer than a row is one press
    // away, whole (v12/detailed/marks.tsx RowWords); it is never cut, and it stays the hover.
    const lead = draw(v, opt.id).querySelector<HTMLElement>(`[data-core-lead="${opt.id}"]`)!
    const press = lead.querySelector<HTMLElement>(`[data-row-words="${opt.id}.rows.0"] button`)!
    expect([press.getAttribute('aria-label'), await hoverWords(press), (await tipOf(lead)).startsWith(long), lead.textContent?.includes(long)]).toEqual([long, long, true, false])
    fireEvent.click(press)
    expect(lead.querySelector('[role="note"]')?.textContent, 'one press shows it whole').toBe(long)
  })

  it('FT14 any card\'s long face line (a challenge\'s paragraph) is drawn whole, never cut; core\'s words whole on hover too', async () => {
    const chal = EU.model!.cards.find((c) => c.family !== 'option' && c.figure === null && c.bound == null)!
    const para = 'A larger pre-seed round may raise the bar for the next raise: later investors expect progress in line with the money raised, so missing milestones could make follow-on funding harder. '.repeat(3).trim()
    const v = withCard(EU, chal.id, (c) => ({ ...c, face: { ...(c.face ?? {}), line: { text: para, words: 'olumi' } } as never }))
    const lead = draw(v, chal.id).querySelector<HTMLElement>(`[data-core-lead="${chal.id}"]`)!
    const clamp = lead.querySelector('[data-core-lead-clamp]')
    expect([/line-clamp|truncate/.test(clamp?.className ?? ''), clamp?.textContent, (await tipOf(lead)).startsWith(para)]).toEqual([false, para, true])
    for (let a: Element | null = clamp ?? null; a !== null && a !== lead.parentElement; a = a.parentElement) expect(a.className, 'no clamp above it either').not.toMatch(/line-clamp|truncate/)
  })

  it('FT15 (Codex PL-500, DERIVED: a 280-character core heading with no face line, as the fresh draft\'s challenge): the title is drawn whole (R6, no clamp), the whole heading its hover; core\'s words unchanged', () => {
    const c0 = EU.model!.cards.find((c) => c.family === 'condition') ?? EU.model!.cards[0]!
    const long = ('A different view comes from later investors: a larger pre-seed round raises the bar for the next raise, because they expect progress in line with the money raised. ').repeat(2).trim()
    expect(long.length).toBeGreaterThan(200)
    const v = withCard(EU, c0.id, (c) => ({ ...c, heading: long, face: { ...(c.face ?? {}), title: null, line: null } as never }))
    const t = draw(v, c0.id).querySelector<HTMLElement>('[data-testid="node-title"]')!
    // R6 (16 Nov): a title is never clamped so that its end is lost: the whole heading is drawn.
    // CHANGED BY DESIGN (surfaces step 1, 18 Nov): no browser tip on the name; the card's hover pop-up names it whole (coreHoverValue.spec).
    expect([t.className.includes('line-clamp'), t.getAttribute('title'), t.textContent!.includes(long)]).toEqual([false, null, true])
  })

  // DL-529 (14 Nov, the component sheet): whose a card is is a first-class mark at its foot, the person's as Olumi's, never hover-only
  // (this row said the opposite until the new look; the ruling changed, the row with it).
  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences, text as icons with a hover; v12/detailed): whose a card is, is its mark at the foot, core's
  // author words its name and hover; Olumi's mark is Olumi's, a person's is the person's.
  it('FT7 (DL-529) whose a card is, is on the card\'s face, at its foot, as a mark named by core\'s author words; Olumi\'s mark for Olumi\'s, the person\'s for the person\'s', () => {
    const person = EU.model!.cards.find((c) => c.author != null && c.author.by !== 'olumi' && c.author.text !== '')!
    const line = draw(EU, person.id).querySelector<HTMLElement>(`[data-core-author="${person.id}"]`)!
    const mark = line.querySelector<HTMLElement>('[data-author-mark]')!
    expect([mark.getAttribute('data-author-mark'), mark.getAttribute('aria-label')?.startsWith(person.author!.text), line.closest('.ok-dt-foot') !== null, line.textContent]).toEqual(['person', true, true, '']); cleanup()
    const theirs = EU.model!.cards.find((c) => c.author?.by === 'olumi')!
    expect(draw(EU, theirs.id).querySelector<HTMLElement>(`[data-core-author="${theirs.id}"] [data-author-mark]`)!.getAttribute('data-author-mark'), 'CONTRAST: Olumi\'s').toBe('olumi')
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

describe('the DL\'s look at A13d (12 Nov)', () => {
  it('PB10: a link into the question alone at the head of the board takes no rail (its short curve); CONTRAST: with an aim beside the question, the rail', () => {
    const q = { x: 0, y: 0, w: 900, h: 80 }, opt = { x: 0, y: 160, w: 240, h: 100 }, rec = { x: 600, y: 360, w: 240, h: 100 }
    expect(railOf(rec, q, [q, opt, rec])).toBeNull()
    const aim = { x: 1000, y: 0, w: 240, h: 80 }
    expect(railOf(rec, q, [q, aim, opt, rec])).not.toBeNull()
  })
})

describe('the DL\'s look at A13f (12 Nov)', () => {
  it('PB11: the first frame is due once the board settles, or after a bounded WAIT IN TIME however few frames a throttled pane drew; CONTRAST: unsettled and early, not yet', () => {
    expect(frameDue(true, 0)).toBe(true)
    expect(frameDue(false, FRAME_WAIT_MS)).toBe(true) // ~5 frames at 3 fps: the old 300-frame cap waited ~100 s
    expect(frameDue(false, FRAME_WAIT_MS - 1)).toBe(false)
    expect(FRAME_WAIT_MS).toBeLessThanOrEqual(2000)
  })
  it('PB12: the board is not painted until its first frame (class ok-board-unframed on the flow, hidden by the look sheet), and never hidden past REVEAL_MS; CONTRAST: the settle\'s own wait is shorter', () => {
    const canvas = readFileSync(path.resolve('src/olumiView/ViewCanvas.tsx'), 'utf8'), look = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    expect(canvas).toMatch(/className=\{framed \? 'olumi-look' : 'olumi-look ok-board-unframed'\}/)
    expect(look).toMatch(/\.olumi-look\.ok-board-unframed \.react-flow__viewport \{ visibility: hidden; \}/)
    expect(canvas).toMatch(/setTimeout\(\(\) => \{ framedRef\.current = true; setFramed\(true\) \}, REVEAL_MS\)/)
    expect(canvas).toMatch(/if \(!holdsCards\) return; const t = setTimeout/) // the wait starts with the first card, not at mount (a cold open mounts before the data)
    expect(canvas).not.toMatch(/drawn\.length === 0 && ids\.size === 0\)\) \{ framedRef/) // an empty board is never "framed"
    expect(REVEAL_MS).toBeGreaterThan(FRAME_WAIT_MS)
    expect(REVEAL_MS).toBeLessThanOrEqual(3000)
    expect((canvas.match(/(?:const|,) FRAME_WAIT_MS =/g) ?? []).length).toBe(1)
  })
})
