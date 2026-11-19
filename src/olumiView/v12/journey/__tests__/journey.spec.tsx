/**
 * Catch up on a scenario (redesign 19 Nov, SYNTHESIS.md items 8, 1, 2, 3, 4). Every row is bound by identity (its key, core's id, the exact
 * field) with a contrast in the same file. Fixture: the in-repo consulting-evidence View (version 2; two pieces of evidence, neither
 * considered; three views given), with `since`, waits_on, a commitment, an outcome, disagreements, kept ideas and a proposal added by shape
 * (invented words).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../../types'
import { useViewStore } from '../../../store'
import { useReveal } from '../../../reveal'
import { useUIStore } from '../../../../stores/uiStore'
import { useCanvasStore } from '../../../../canvas/store'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { useVersionsPanelStore } from '../../../../canvas/versions/versionsPanelStore'
import { isEmpty, journeyOf, JOURNEY_WORDS as W, type JourneyContext } from '../journey'

const focused: string[] = []
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusNodeById: (id: string) => { focused.push(id) } }))
let next: unknown = null
vi.mock('../../../ViewChat', () => ({ nextStepOf: () => next }))
const outcomeForms: Array<[string, number]> = []
vi.mock('../../../../olumiCore/team/outcomeNav', () => ({ goToOutcome: (sid: string, id: number) => { outcomeForms.push([sid, id]) } }))

const { JourneyRecord } = await import('../JourneyRecord')
const { CatchUp, catchUpCounts } = await import('../CatchUp')
const { WhatChangedPanel } = await import('../../../../canvas/versions/WhatChangedPanel')

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11/consulting-evidence.view3.json'), 'utf8')) as View
const N = base.version!.n
const SINCE = {
  heading: 'Since the version before', from: { n: N - 1, label: 'version 1' }, to: { n: N, label: 'version 2' },
  changed: [{ id: 'add_consulting', label: 'An invented option', whose: 'theirs', was: 'olumi' }, { id: 'not_a_card', label: 'An invented gone card', whose: 'olumi', was: null }],
  sole: 'time_to_contract',
  lines: [
    { option: 'add_consulting', aim: 'generate_revenue_quickly', from: 0.2, to: 0.5, from_text: 'about 20%', to_text: 'about 50%', line: 'An invented core line about the move.' },
    { option: 'paid_enterprise_diagnostic', aim: 'generate_revenue_quickly', from: 0.4, to: 0.4, from_text: 'about 40%', to_text: 'about 40%', line: 'An invented unchanged line.' },
  ],
}
const WAITS = { head: 'h', label: 'l', text: 't', items: [{ id: 'contract_to_cash', text: 'An invented wait', title: 'hover', answer: false, unknown: 'not known yet', edit: { prompt: 'p', ask: 'Give a figure' } }] }
const COMMITMENT = (outcomes: unknown[] = []) => ({
  id: 501, at: '2026-11-07T17:00:00.000Z', by: 'Maya', by_id: 'm', action: 'An invented action, written by Maya in full so it wraps across lines rather than being cut.', owner: 'Maya', owner_id: 'm',
  expect: 'An invented expectation.', reconsider: 'An invented reason to reconsider.', keeps: [], option: null, version: 2,
  expect_band: { low: 1, median: null, high: 3, unit: 'month', text: '1 to 3 months' }, review_on: '2026-12-01',
  trigger: { fact: 'f', kind: 'chance', option: 'add_consulting', aim: 'generate_revenue_quickly', versus: null, figure: 'x', text: 't', finding: 'f', version: 1, stale: { reasons: [], text: 'An invented stale reason.' } },
  outcomes,
})
const OUTCOME = { id: 601, at: '2026-11-08T09:00:00.000Z', by: 'Tom', by_id: 't', happened: 'An invented thing that happened.', versus: 'An invented comparison.', reconsider_triggered: true, note: null, figure: { value: 2, unit: 'month', text: '2 months' }, dissent: [] }
const DISSENT = [
  { id: 'd_mine', holder: 'Me', position: 'My invented position.', holder_id: base.you_id, confirmed: null },
  { id: 'd_other', holder: 'Tom', position: 'Tom’s invented position.', holder_id: 't', confirmed: null },
  { id: 'd_done', holder: 'Priya', position: 'p', holder_id: 'p', confirmed: { at: '2026-11-07T18:00:00Z', by_id: 'p', words: 'Priya’s invented confirmed words.', tell: 'An invented tell.' } },
]
const KEPT = [{ id: 1, turn: 2, text: 'An invented idea.', by: 'olumi', kept_by: { id: 'p', name: 'Priya' }, at: '2026-11-07T16:00:00Z', concerns: [] }]
const full = (extra: Record<string, unknown> = {}): View => ({
  ...base,
  model: { ...base.model!, run: { ...base.model!.run!, since: SINCE, waits_on: WAITS } },
  collab: { ...base.collab, commitments: [COMMITMENT()], dissent: DISSENT, can_reveal: true },
  kept: KEPT, proposal: { id: 9, heading: 'An invented proposal heading.' },
  ...extra,
} as unknown as View)
const CTX: JourneyContext = { at: null, keptNode: () => 'idea:kept:1', hasNext: false }
const show = (view: View, at: number | null = null) => useViewStore.setState({ uuid: 'u', sid: 's_0123456789ab', view, status: 'ready', error: null, stale: false, at })

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f: FrameRequestCallback) => { f(0); return 0 })
  useCanvasStore.setState({ nodes: [{ id: 'add_consulting' }, { id: 'time_to_contract' }, { id: 'contract_to_cash' }, { id: 'idea:kept:1' }] as never })
  next = null
})
afterEach(() => { cleanup(); focused.length = 0; outcomeForms.length = 0; useReveal.getState().select(null); vi.restoreAllMocks() })

describe('#1 how the conclusions moved: core\'s chances, its line one press away, the credited card', () => {
  it('one row per option and aim, named by its card, before → now in core\'s words; an unchanged one says so once', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    const row = screen.getByTestId('journey-move:add_consulting:generate_revenue_quickly')
    expect(row).toHaveTextContent('about 20% → about 50%')
    expect(row).toHaveTextContent(base.model!.cards.find((c) => c.id === 'add_consulting')!.heading)
    expect(screen.getByTestId('journey-move:paid_enterprise_diagnostic:generate_revenue_quickly')).toHaveAttribute('data-same', 'true')
    expect(screen.getByTestId('journey-move:paid_enterprise_diagnostic:generate_revenue_quickly')).not.toHaveTextContent('→')
    // core's own line is behind one press, never at rest
    expect(screen.queryByTestId('journey-move:add_consulting:generate_revenue_quickly-line')).toBeNull()
    fireEvent.click(screen.getByTestId('journey-move:add_consulting:generate_revenue_quickly-toggle'))
    expect(screen.getByTestId('journey-move:add_consulting:generate_revenue_quickly-line')).toHaveTextContent(SINCE.lines[0]!.line)
  })
  it('the one change core credits (`sole`) is a card one press away; with no `sole` none is credited', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    fireEvent.click(within(screen.getByTestId('journey-sole')).getByTestId('journey-card-time_to_contract'))
    expect(focused).toEqual(['time_to_contract'])
    cleanup()
    const none = full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, sole: null } } } })
    render(<JourneyRecord view={none} at={null} />)
    expect(screen.queryByTestId('journey-sole')).toBeNull()
  })
  it('a `since` to another version is not this version\'s movement', () => {
    const other = full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, to: { n: N + 1, label: 'version 3' } } } } })
    expect(journeyOf(other, CTX).moved).toBeNull()
    expect(journeyOf(full(), CTX).moved?.rows).toHaveLength(2)
  })
})

describe('#8 the five defects', () => {
  it('(a) neutral chrome is not Olumi blue: the proposal line is neutral; a kept idea (Olumi\'s) is blue', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    expect(screen.getByTestId('journey-proposal').innerHTML).not.toContain('text-info')
    fireEvent.click(screen.getByTestId('journey-history-toggle'))
    expect(screen.getByTestId('journey-kept:1').innerHTML).toContain('text-info')
  })
  it('(b) no silent buttons: a card the View does not hold is drawn plain with its reason; one it holds is a button', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    const gone = screen.getByTestId('journey-card-not_a_card')
    expect(gone.tagName).not.toBe('BUTTON')
    expect(gone).toHaveAttribute('data-unavailable', 'true')
    expect(screen.getByTestId('journey-card-not_a_card-why')).toHaveTextContent(W.offCanvas)
    expect(screen.getByTestId('journey-card-add_consulting').tagName).toBe('BUTTON')
  })
  it('(b) a card the View holds but the canvas does not draw now says why on the press, and the panel stays', () => {
    useCanvasStore.setState({ nodes: [] as never })
    const done = vi.fn()
    show(full()); render(<JourneyRecord view={full()} at={null} onDone={done} />)
    fireEvent.click(screen.getByTestId('journey-card-add_consulting'))
    expect(screen.getByTestId('journey-card-add_consulting-why')).toHaveTextContent(W.offCanvas)
    expect(done).not.toHaveBeenCalled()
  })
  it('(c) a commitment keeps its identity: the press opens Team on THAT commitment, with any reveal stepped aside', () => {
    const target = document.createElement('li'); target.setAttribute('data-testid', 'team-commitment-501'); const scrolled = vi.fn(); target.scrollIntoView = scrolled; document.body.appendChild(target)
    const decoy = document.createElement('li'); decoy.setAttribute('data-testid', 'team-commitment-502'); const wrong = vi.fn(); decoy.scrollIntoView = wrong; document.body.appendChild(decoy)
    useReveal.getState().selectEvidence(28)
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    const done = vi.fn()
    show(full()); render(<JourneyRecord view={full()} at={null} onDone={done} />)
    fireEvent.click(screen.getByTestId('journey-commitment:501'))
    expect(force).toHaveBeenLastCalledWith('team')
    expect(useReveal.getState().evidence).toBeNull()
    expect(scrolled).toHaveBeenCalledTimes(1)
    expect(wrong).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    target.remove(); decoy.remove()
  })
  it('(c) an outcome, a disagreement and a commitment with no outcome open their own record (the outcome form by core\'s id)', () => {
    show(full({ collab: { ...base.collab, commitments: [COMMITMENT()], dissent: DISSENT, can_reveal: true } })); render(<JourneyRecord view={useViewStore.getState().view!} at={null} />)
    fireEvent.click(screen.getByTestId('journey-no-outcome:501'))
    expect(outcomeForms).toEqual([['s_0123456789ab', 501]])
  })
  it('(c) on an earlier version Team\'s records say why they cannot open; a card still opens', () => {
    show(full(), 1); render(<JourneyRecord view={full()} at={1} />)
    expect(screen.getByTestId('journey-commitment:501')).toHaveAttribute('data-unavailable', 'true')
    expect(screen.getByTestId('journey-commitment:501-why')).toHaveTextContent(W.earlier)
    expect(screen.getByTestId('journey-wait:contract_to_cash').tagName).toBe('BUTTON')
  })
  it('(d) the person\'s words are inside the control, whole', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    const button = screen.getByTestId('journey-commitment:501')
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveTextContent(COMMITMENT().action)
    expect(button.innerHTML).not.toContain('truncate')
  })
  it('(e) with no `since`, the version\'s own changed records are named (only those the View holds as cards); `was` is kept', () => {
    const noSince = full({ model: { ...base.model!, run: { ...base.model!.run!, since: null, waits_on: null } } })
    const j = journeyOf(noSince, CTX)
    const cards = new Set(base.model!.cards.map((c) => c.id))
    expect(j.changed?.cards.map((c) => c.id)).toEqual(base.version!.changed.filter((id) => cards.has(id)))
    expect(j.changed!.cards.length).toBeLessThan(base.version!.changed.length) // contrast: ids with no card are left out
    expect(journeyOf(full(), CTX).changed?.cards[0]).toMatchObject({ id: 'add_consulting', olumi: false, was: 'olumi' })
  })
})

describe('#2 open items, each with its exact action', () => {
  it('lists what the result waits on, unconsidered evidence, a commitment with no outcome (review date), a stale reason, MY unconfirmed disagreement, views to reveal and a proposal', () => {
    const keys = journeyOf(full(), CTX).open.map((o) => o.key)
    expect(keys).toEqual(['wait:contract_to_cash', 'consider:28', 'consider:29', 'no-outcome:501', 'stale:501', 'confirm:d_mine', 'reveal', 'proposal'])
    // contrast: someone else's unconfirmed disagreement is not mine to confirm; a considered piece is not open
    expect(keys).not.toContain('confirm:d_other')
    const considered = full({ evidence: base.evidence.map((e) => ({ ...e, considered: { at: 'x', by: 'Olumi', proposal: null, why: null } })) })
    expect(journeyOf(considered, CTX).open.some((o) => o.key.startsWith('consider:'))).toBe(false)
  })
  it('each opens its own thing: the waited-on card, that evidence in Team, the next step in the chat', () => {
    next = { kind: 'move', turn: 3 }
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    expect(screen.getByTestId('journey-no-outcome:501')).toHaveTextContent('review on 1 Dec 2026')
    fireEvent.click(screen.getByTestId('journey-wait:contract_to_cash'))
    expect(focused).toEqual(['contract_to_cash'])
    fireEvent.click(screen.getByTestId('journey-consider:29'))
    expect(useReveal.getState().evidence).toBe(29)
    fireEvent.click(screen.getByTestId('journey-next'))
    expect(force).toHaveBeenLastCalledWith('olumi')
    cleanup(); next = null
    render(<JourneyRecord view={full()} at={null} />)
    expect(screen.queryByTestId('journey-next')).toBeNull() // contrast: no current Next step, no row
  })
})

describe('#3 commitments as expectations', () => {
  it('owner, review date, expected band (core\'s text), reason to reconsider, and each outcome with its figure and what was recorded', () => {
    const v = full({ collab: { ...base.collab, commitments: [COMMITMENT([OUTCOME])], dissent: [], can_reveal: false } })
    show(v); render(<JourneyRecord view={v} at={null} />)
    const k = screen.getByTestId('journey-commitment:501')
    expect(k).toHaveTextContent('Owner: Maya · review on 1 Dec 2026')
    expect(k).toHaveTextContent('Expected: 1 to 3 months')
    expect(k).toHaveTextContent('Reconsider if: An invented reason to reconsider.')
    const o = screen.getByTestId('journey-outcome:601')
    expect(o).toHaveTextContent('An invented thing that happened. · 2 months')
    expect(o).toHaveTextContent(W.triggered)
    expect(journeyOf(v, CTX).open.some((x) => x.key === 'no-outcome:501')).toBe(false) // contrast: it has an outcome now
  })
})

describe('history behind one press, grouped by meaning', () => {
  it('evidence (with whether it was considered), confirmed disagreements with their tell, kept ideas, views given', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    expect(screen.queryByTestId('journey-history')).toBeNull()
    fireEvent.click(screen.getByTestId('journey-history-toggle'))
    expect(screen.getByTestId('journey-evidence:28')).toHaveTextContent(W.notYet)
    expect(screen.getByTestId('journey-dissent:d_done')).toHaveTextContent('An invented tell.')
    expect(screen.queryByTestId('journey-dissent:d_mine')).toBeNull()
    fireEvent.click(screen.getByTestId('journey-kept:1'))
    expect(focused).toEqual(['idea:kept:1'])
    expect(screen.getByTestId('journey-views')).toHaveTextContent('3 views given')
  })
  it('claims no stage and nothing to say draws nothing', () => {
    const words = JSON.stringify(journeyOf(full(), CTX))
    for (const s of ['STRATEGISE', 'FRAME', 'IDEATE', 'EVALUATE', 'IMPROVE']) expect(words).not.toContain(s)
    const empty = { ...base, model: { ...base.model!, run: { ...base.model!.run!, since: null, waits_on: null } }, version: { ...base.version!, changed: [] }, collab: { ...base.collab, commitments: [], shared: [], dissent: [], can_reveal: false }, evidence: [], kept: [], proposal: null } as unknown as View
    expect(isEmpty(journeyOf(empty, CTX))).toBe(true)
  })
})

describe('#4 the way into Catch up from the Olumi panel', () => {
  it('counts only what the panel holds (moved conclusions, open items) and opens the panel; nothing to say, no row', () => {
    expect(catchUpCounts(full(), null)).toEqual({ moved: 1, open: 8 })
    show(full()); useVersionsPanelStore.setState({ isOpen: false }); render(<CatchUp />)
    expect(screen.getByTestId('journey-catch-up')).toHaveTextContent('Catch up · 1 conclusion moved · 8 open')
    fireEvent.click(screen.getByTestId('journey-catch-up'))
    expect(useVersionsPanelStore.getState().isOpen).toBe(true)
    cleanup()
    show({ ...base, model: { ...base.model!, run: { ...base.model!.run!, since: null, waits_on: null } }, evidence: [], collab: { ...base.collab, can_reveal: false }, proposal: null } as unknown as View)
    render(<CatchUp />)
    expect(screen.queryByTestId('journey-catch-up')).toBeNull()
  })
})

describe('the history panel on the lane: Catch up above core\'s versions, loaded on open', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    setTeamFetch((async () => new Response(JSON.stringify({ versions: [{ id: 41, n: 1, at: '2026-11-07T10:00:00Z', by: 'Priya', base: null }] }), { status: 200 })) as unknown as typeof fetch)
    show(full())
  })
  afterEach(() => { setTeamFetch(null); vi.unstubAllEnvs() })
  it('draws the record first, then core\'s versions', async () => {
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    const record = await screen.findByTestId('journey-record')
    const versions = await screen.findByTestId('core-versions')
    expect(record.compareDocumentPosition(versions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('off the lane the panel is the local history as before, with no record', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    expect(screen.queryByTestId('journey-record')).toBeNull()
    expect(screen.getByTestId('versions-vocabulary-disclosure')).toBeTruthy()
  })
})
