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
import { create } from 'zustand'
import type { View } from '../../../types'
import { useViewStore } from '../../../store'
import { useReveal } from '../../../reveal'
import { useUIStore } from '../../../../stores/uiStore'
import { useCanvasStore } from '../../../../canvas/store'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { useVersionsPanelStore } from '../../../../canvas/versions/versionsPanelStore'
import { resetTeamFlow, useTeamFlow } from '../../../../olumiCore/team/flow'
import { tipOnFocus } from '../../../__tests__/tipHelpers'
import { isEmpty, journeyOf, JOURNEY_WORDS as W, type JourneyContext } from '../journey'

const focused: string[] = []
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusNodeById: (id: string) => { focused.push(id) } }))
// The chat's store, as ViewChat holds it (the next-step predicate itself is the REAL replyMoveFor, not mocked): `gone` is the move the chat refused as stale (ViewChat `moveKey`: sid, turn, move joined by NUL).
const chat = vi.hoisted(() => ({ store: null as unknown as { setState: (s: { gone: string | null }) => void } }))
vi.mock('../../../ViewChat', () => {
  const useViewChat = create<{ gone: string | null }>()(() => ({ gone: null }))
  chat.store = useViewChat
  return { useViewChat, moveKey: (sid: string, turn: number, move: string) => `${sid}\u0000${turn}\u0000${move}` }
})
const outcomeForms: Array<[string, number]> = []
vi.mock('../../../../olumiCore/team/outcomeNav', () => ({ goToOutcome: (sid: string, id: number) => { outcomeForms.push([sid, id]) } }))

const { JourneyRecord, default: JourneyRecordBlock } = await import('../JourneyRecord')
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
const OUTCOME = { id: 601, at: '2026-11-08T09:00:00.000Z', by: 'Tom', by_id: 't', happened: 'An invented thing that happened.', versus: 'worse', reconsider_triggered: true, note: null, figure: { value: 2, unit: 'month', text: '2 months' }, dissent: [] }
const DISSENT = [
  { id: 'd_mine', holder: 'Me', position: 'My invented position.', holder_id: base.you_id, confirmed: null },
  { id: 'd_other', holder: 'Tom', position: 'Tom’s invented position.', holder_id: 't', confirmed: null },
  { id: 'd_done', holder: 'Priya', position: 'p', holder_id: 'p', confirmed: { at: '2026-11-07T18:00:00Z', by_id: 'p', words: 'Priya’s invented confirmed words.', tell: 'An invented tell.' } },
]
const KEPT = [{ id: 1, turn: 2, text: 'An invented idea.', by: 'olumi', kept_by: { id: 'p', name: 'Priya' }, at: '2026-11-07T16:00:00Z', concerns: [] }]
// The newest reply's own move, as core sends it (`answer.next`): the fixture's last turn with its move and `newest` set. The default is no move.
const chatWith = (move: string | null, newest: boolean) => base.chat.map((t, i) => i < base.chat.length - 1 ? t : { ...t, answer: { ...t.answer!, next: { ...t.answer!.next, move, newest } } })
const TURN = base.chat.at(-1)!.id
const full = (extra: Record<string, unknown> = {}): View => ({
  ...base,
  chat: chatWith(null, false),
  model: { ...base.model!, run: { ...base.model!.run!, since: SINCE, waits_on: WAITS } },
  collab: { ...base.collab, commitments: [COMMITMENT()], dissent: DISSENT, can_reveal: true },
  kept: KEPT, proposal: { id: 9, heading: 'An invented proposal heading.' },
  ...extra,
} as unknown as View)
const CTX: JourneyContext = { at: null, keptNode: () => 'idea:kept:1', hasNext: false }
const moveOn = (move: string | null, newest = true): View => full({ chat: chatWith(move, newest) })
const show = (view: View, at: number | null = null) => useViewStore.setState({ uuid: 'u', sid: 's_0123456789ab', view, status: 'ready', error: null, stale: false, at })

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f: FrameRequestCallback) => { f(0); return 0 })
  useCanvasStore.setState({ nodes: [{ id: 'add_consulting' }, { id: 'time_to_contract' }, { id: 'contract_to_cash' }, { id: 'idea:kept:1' }] as never })
  chat.store.setState({ gone: null })
})
afterEach(() => { cleanup(); focused.length = 0; outcomeForms.length = 0; useReveal.getState().select(null); vi.restoreAllMocks() })

describe('#1 how the conclusions moved: core\'s chances, its line one press away, the credited card', () => {
  it('one row per option and aim that moved, named by its card, before → now in core\'s words; a row whose two texts are the same is not drawn (no "X → X"), and nothing is called "unchanged"', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    const row = screen.getByTestId('journey-move:add_consulting:generate_revenue_quickly')
    expect(row).toHaveTextContent('about 20% → about 50%')
    expect(row).toHaveTextContent(base.model!.cards.find((c) => c.id === 'add_consulting')!.heading)
    // S4 journeyauth: core's two texts the same ("about 40% → about 40%") says nothing, so the row is dropped; the moved row above is the contrast.
    expect(screen.queryByTestId('journey-move:paid_enterprise_diagnostic:generate_revenue_quickly')).toBeNull()
    expect(screen.getByTestId('journey-record')).not.toHaveTextContent('about 40% → about 40%')
    expect(screen.getByTestId('journey-record')).not.toHaveTextContent(/unchanged/i)
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
  it('the credited change is Olumi\'s only where core\'s change entry says so; with no entry it is neutral, whatever the card\'s own mark (S4 journeyauth)', () => {
    const soleOf = (sole: string, changed = SINCE.changed) => journeyOf(full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, sole, changed } } } }), CTX).moved!.sole!
    expect(soleOf('time_to_contract')).toMatchObject({ id: 'time_to_contract', olumi: false }) // not in `changed`: core names no author, though the card carries an Olumi mark
    expect(base.model!.cards.find((c) => c.id === 'time_to_contract')!.olumi).not.toBeNull() // contrast: the mark is there and is not used
    expect(soleOf('add_consulting')).toMatchObject({ id: 'add_consulting', olumi: false, was: 'olumi' }) // contrast: core says it is the team's now
    expect(soleOf('time_to_contract', [{ id: 'time_to_contract', label: 'x', whose: 'olumi', was: null }])).toMatchObject({ olumi: true }) // contrast: core's entry says Olumi made it
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    expect(within(screen.getByTestId('journey-sole')).getByTestId('journey-card-time_to_contract').innerHTML).not.toContain('text-info')
    cleanup()
    const byOlumi = full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, sole: 'time_to_contract', changed: [{ id: 'time_to_contract', label: 'x', whose: 'olumi', was: null }] } } } })
    show(byOlumi); render(<JourneyRecord view={byOlumi} at={null} />)
    expect(within(screen.getByTestId('journey-sole')).getByTestId('journey-card-time_to_contract').innerHTML).toContain('text-info')
  })
  it('with `since`, the cards this version ADDED are named too: core\'s change entries first, then `version.changed` cards by id, each once', () => {
    const cards = new Set(base.model!.cards.map((c) => c.id)), inSince = new Set(SINCE.changed.map((c) => c.id))
    const added = base.version!.changed.filter((id) => cards.has(id) && !inSince.has(id))
    expect(added).toContain('time_to_contract') // the fixture's version holds an added Olumi card
    const ch = journeyOf(full(), CTX).changed!.cards
    expect(ch.map((c) => c.id)).toEqual([...SINCE.changed.map((c) => c.id), ...added])
    expect(ch.find((c) => c.id === 'time_to_contract')).toMatchObject({ olumi: false, was: null }) // added: core names no author for it, so neutral
    expect(ch.find((c) => c.id === 'add_consulting')).toMatchObject({ olumi: false, was: 'olumi' }) // contrast: core's own entry keeps whose and was
    expect(new Set(ch.map((c) => c.id)).size).toBe(ch.length)
  })
  it('a credited record with no card is named by core\'s label, never its raw id; with no name at all nothing is credited', () => {
    const at = (sole: string, changed = SINCE.changed) => journeyOf(full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, sole, changed } } } }), CTX).moved!.sole
    expect(at('not_a_card')).toMatchObject({ id: 'not_a_card', label: 'An invented gone card' })
    expect(at('a_lever_id', [])).toBeNull()
    expect(at('add_consulting')?.label).toBe(base.model!.cards.find((c) => c.id === 'add_consulting')!.heading) // contrast: a card keeps its heading
  })
  it('a `since` to another version is not this version\'s movement', () => {
    const other = full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, to: { n: N + 1, label: 'version 3' } } } } })
    expect(journeyOf(other, CTX).moved).toBeNull()
    expect(journeyOf(full(), CTX).moved?.rows).toHaveLength(1) // the same-text line is dropped
  })
})

describe('#8 the five defects', () => {
  it('a chip names its previous author only in core\'s fact: "was Olumi\'s" shown, never the page\'s own "was the team\'s"', () => {
    const chg = (was: 'olumi' | 'theirs') => full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, changed: [{ id: 'add_consulting', label: 'An invented option', whose: was === 'olumi' ? 'theirs' : 'olumi', was }] } } } })
    show(chg('olumi')); render(<JourneyRecord view={chg('olumi')} at={null} />)
    expect(screen.getByTestId('journey-changed')).toHaveTextContent('(was Olumi’s)') // contrast
    cleanup()
    show(chg('theirs')); render(<JourneyRecord view={chg('theirs')} at={null} />)
    expect(screen.getByTestId('journey-changed')).not.toHaveTextContent(/was the team/)
    expect(screen.getByTestId('journey-changed')).not.toHaveTextContent('(was')
  })
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
  it('(b) a changed record the model still holds with no card (an estimate a card rests on) is a plain chip: no press, no reason', () => {
    const changed = [{ id: 'cash_reading', label: 'An invented estimate', whose: 'olumi' as const, was: null }, ...SINCE.changed]
    const v = full({ model: { ...base.model!, run: { ...base.model!.run!, since: { ...SINCE, sole: 'cash_reading', changed } } } })
    expect(base.model!.cards.some((c) => c.id === 'cash_reading')).toBe(false)
    expect(base.model!.cards.some((c) => c.rests_on.some((r) => r.id === 'cash_reading'))).toBe(true) // held by the model, by its typed id
    show(v); render(<JourneyRecord view={v} at={null} />)
    const held = within(screen.getByTestId('journey-changed')).getByTestId('journey-card-cash_reading')
    expect(held).toHaveAttribute('data-plain', 'true')
    expect(held.tagName).not.toBe('BUTTON')
    expect(held.querySelector('button')).toBeNull()
    expect(screen.queryByTestId('journey-card-cash_reading-why')).toBeNull()
    expect(journeyOf(v, CTX).moved!.sole!.press).toEqual({ plain: true }) // the credited record too
    // contrast: a record the View does not hold keeps its reason
    expect(screen.getByTestId('journey-card-not_a_card')).toHaveAttribute('data-unavailable', 'true')
    expect(screen.getByTestId('journey-card-not_a_card-why')).toHaveTextContent(W.offCanvas)
  })
  it('(b) a card the View holds but the canvas does not draw now says why on the press, and the panel stays', () => {
    useCanvasStore.setState({ nodes: [] as never })
    const done = vi.fn()
    show(full()); render(<JourneyRecord view={full()} at={null} onDone={done} />)
    fireEvent.click(screen.getByTestId('journey-card-add_consulting'))
    expect(screen.getByTestId('journey-card-add_consulting-why')).toHaveTextContent(W.offCanvas)
    expect(done).not.toHaveBeenCalled()
  })
  it('(c) a commitment keeps its identity: the press opens Team\'s "What happened" step on THAT commitment, its fold opened, any reveal stepped aside', () => {
    resetTeamFlow()
    const fold = document.createElement('details'); document.body.appendChild(fold)
    const target = document.createElement('li'); target.setAttribute('data-testid', 'team-commitment-501'); const scrolled = vi.fn(); target.scrollIntoView = scrolled; fold.appendChild(target)
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
    expect(useTeamFlow.getState().pending).toBe('outcome')
    expect(fold.open).toBe(true)
    expect(done).toHaveBeenCalledTimes(1)
    fold.remove(); decoy.remove()
  })
  it('(c) a disagreement opens "Where you differ"; views ready to reveal open the reveal step', () => {
    resetTeamFlow(); show(full()); render(<JourneyRecord view={full()} at={null} />)
    fireEvent.click(screen.getByTestId('journey-confirm:d_mine'))
    expect(useTeamFlow.getState().pending).toBe('differ')
    fireEvent.click(screen.getByTestId('journey-reveal'))
    expect(useTeamFlow.getState().pending).toBe('reveal')
  })
  it('(c) an outcome, a disagreement and a commitment with no outcome open their own record (the outcome form by core\'s id)', () => {
    show(full({ collab: { ...base.collab, commitments: [COMMITMENT()], dissent: DISSENT, can_reveal: true } })); render(<JourneyRecord view={useViewStore.getState().view!} at={null} />)
    fireEvent.click(screen.getByTestId('journey-no-outcome:501'))
    expect(outcomeForms).toEqual([['s_0123456789ab', 501]])
  })
  it('(c) an outcome and a disagreement open THAT record in Team, not another of the same kind (Codex NO-GO 5)', () => {
    const place = (id: string) => { const el = document.createElement('li'); el.setAttribute('data-testid', id); const f = vi.fn(); el.scrollIntoView = f; document.body.appendChild(el); return { el, f } }
    const OUT2 = { ...OUTCOME, id: 602, happened: 'An invented second outcome.' }
    const v = full({ collab: { ...base.collab, commitments: [COMMITMENT([OUTCOME, OUT2])], dissent: DISSENT, can_reveal: false } })
    const t601 = place('team-outcome-601'), t602 = place('team-outcome-602'), mine = place('team-dissent-d_mine'), other = place('team-dissent-d_other'), done = place('team-dissent-d_done')
    resetTeamFlow(); show(v); render(<JourneyRecord view={v} at={null} />)
    fireEvent.click(screen.getByTestId('journey-outcome:602'))
    expect(useTeamFlow.getState().pending).toBe('outcome')
    expect(t602.f).toHaveBeenCalledTimes(1); expect(t601.f).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('journey-confirm:d_mine'))
    expect(useTeamFlow.getState().pending).toBe('differ')
    expect(mine.f).toHaveBeenCalledTimes(1); expect(other.f).not.toHaveBeenCalled(); expect(done.f).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('journey-history-toggle'))
    fireEvent.click(screen.getByTestId('journey-dissent:d_done'))
    expect(done.f).toHaveBeenCalledTimes(1); expect(other.f).not.toHaveBeenCalled(); expect(mine.f).toHaveBeenCalledTimes(1)
    for (const x of [t601, t602, mine, other, done]) x.el.remove()
  })
  it('(c) on an earlier version Team\'s records say why they cannot open; a card still opens', () => {
    show(full(), 1); render(<JourneyRecord view={full()} at={1} />)
    expect(screen.getByTestId('journey-commitment:501')).toHaveAttribute('data-unavailable', 'true')
    expect(screen.getByTestId('journey-commitment:501-why')).toHaveTextContent(W.earlier)
    expect(screen.getByTestId('journey-wait:contract_to_cash').tagName).toBe('BUTTON')
  })
  it('on an earlier version Team\'s records are not listed as open now (core reads them as they stood then); its model\'s waits still are', () => {
    const v = full({ collab: { ...base.collab, commitments: [COMMITMENT([])] } })
    const keys = (at: number | null) => journeyOf(v, { ...CTX, at }).open.map((x) => x.key)
    expect(keys(null)).toEqual(expect.arrayContaining(['no-outcome:501', 'stale:501'])) // contrast: on the current version they are open
    expect(keys(null).some((k) => k.startsWith('consider:'))).toBe(true)
    const then = keys(1)
    expect(then.filter((k) => /^(consider|no-outcome|stale|confirm):|^reveal$/.test(k))).toEqual([])
    expect(then).toContain('wait:contract_to_cash')
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
    // Codex NO-GO 3: with no `since`, an Olumi card keeps its mark; a team card does not take one
    // S4 journeyauth: with no `since` nobody is credited: every chip is neutral and unlabelled, Olumi-marked card or not
    expect(base.model!.cards.find((c) => c.id === 'time_to_contract')!.olumi).not.toBeNull()
    expect(j.changed!.cards.every((c) => !c.olumi && c.was === null)).toBe(true)
    show(noSince); render(<JourneyRecord view={noSince} at={null} />)
    expect(screen.getByTestId('journey-changed').innerHTML).not.toContain('text-info')
    expect(screen.getByTestId('journey-changed')).not.toHaveTextContent(/was (Olumi|the team)/)
    cleanup()
    // four chips at rest, the rest behind one press
    show(noSince); render(<JourneyRecord view={noSince} at={null} />)
    const shown = () => screen.getByTestId('journey-changed').querySelectorAll('[data-testid^="journey-card-"]').length
    expect(shown()).toBe(Math.min(4, j.changed!.cards.length))
    if (j.changed!.cards.length > 4) { fireEvent.click(screen.getByTestId('journey-changed-more')); expect(shown()).toBe(j.changed!.cards.length) }
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
  it('P4: a pressable row has exactly ONE tab stop (the button), and real focus on it shows core\'s title; no tabindex child inside', async () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    const row = screen.getByTestId('journey-wait:contract_to_cash')
    expect(row.tagName).toBe('BUTTON')
    expect(row.querySelectorAll('[tabindex]')).toHaveLength(0)
    // core's words for the row: the figure's own ask where the wait has an edit (journey.ts `edit.ask ?? title`), else its title
    expect(await tipOnFocus(row)).toBe('Give a figure')
  })
  it('each opens its own thing: the waited-on card, that evidence in Team, the next step in the chat', () => {
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    show(moveOn('what_would_change_your_mind')); render(<JourneyRecord view={moveOn('what_would_change_your_mind')} at={null} />)
    expect(screen.getByTestId('journey-no-outcome:501')).toHaveTextContent('review on 1 Dec 2026')
    fireEvent.click(screen.getByTestId('journey-wait:contract_to_cash'))
    expect(focused).toEqual(['contract_to_cash'])
    fireEvent.click(screen.getByTestId('journey-consider:29'))
    expect(useReveal.getState().evidence).toBe(29)
    fireEvent.click(screen.getByTestId('journey-next'))
    expect(force).toHaveBeenLastCalledWith('olumi')
    cleanup()
    render(<JourneyRecord view={full()} at={null} />)
    expect(screen.queryByTestId('journey-next')).toBeNull() // contrast: no current Next step, no row
  })
  it('the record is drawn only through the canvas\'s own gate: never while an approval or edit is re-read, never from a failed read', () => {
    const at = (s: { stale: boolean; error: string | null }) => { cleanup(); useViewStore.setState({ ...s }); render(<JourneyRecordBlock />); return screen.queryByTestId('journey-proposal') }
    show(full())
    expect(at({ stale: false, error: null })).toBeInTheDocument() // contrast: the current View draws
    expect(at({ stale: true, error: null })).toBeNull() // the refetch window: an approval or edit is being re-read
    expect(at({ stale: true, error: 'read failed' })).toBeNull() // the re-read failed: the old View is kept in the store, never drawn as current
    // Codex 15:08: a fresh View with no model yet (kept ideas only) still draws its record
    cleanup(); show({ ...full(), model: null } as unknown as View); render(<JourneyRecordBlock />)
    expect(screen.getByTestId('journey-proposal')).toBeInTheDocument()
  })
  it('with a proposal waiting, its row is the way to it and is not repeated as "Go to the next step"; a real reply move beside it is still offered', () => {
    show(full()); render(<JourneyRecord view={full()} at={null} />)
    expect(screen.getByTestId('journey-proposal')).toBeInTheDocument()
    expect(screen.queryByTestId('journey-next')).toBeNull() // the proposal alone is not a reply move
    cleanup(); show(moveOn('other_method')); render(<JourneyRecord view={moveOn('other_method')} at={null} />)
    expect(screen.queryByTestId('journey-next')).toBeNull() // the filler move names no step
    cleanup(); show(moveOn('what_would_change_your_mind', false)); render(<JourneyRecord view={moveOn('what_would_change_your_mind', false)} at={null} />)
    expect(screen.queryByTestId('journey-next')).toBeNull() // a reply that is no longer the newest offers none
    cleanup(); show(moveOn('what_would_change_your_mind')); render(<JourneyRecord view={moveOn('what_would_change_your_mind')} at={null} />)
    expect(screen.getByTestId('journey-next')).toBeInTheDocument() // contrast: the real newest move, beside the proposal
  })
  it('a move the chat refused as stale is no next step here either (Codex NO-GO 4: the chat\'s own exclusion), against the real predicate', () => {
    const v = moveOn('what_would_change_your_mind')
    show(v)
    chat.store.setState({ gone: `s_0123456789ab\u0000${TURN}\u0000what_would_change_your_mind` })
    render(<JourneyRecord view={v} at={null} />)
    expect(screen.queryByTestId('journey-next')).toBeNull()
    cleanup()
    chat.store.setState({ gone: `s_0123456789ab\u0000${TURN + 1}\u0000what_would_change_your_mind` }) // contrast: another turn's refusal leaves this step offered
    render(<JourneyRecord view={v} at={null} />)
    expect(screen.getByTestId('journey-next')).toBeInTheDocument()
  })
})

describe('#3 commitments as expectations', () => {
  it('owner, review date, expected band (core\'s text), reason to reconsider, and each outcome with its figure and what was recorded', () => {
    const v = full({ collab: { ...base.collab, commitments: [COMMITMENT([OUTCOME])], dissent: [], can_reveal: false } })
    show(v); render(<JourneyRecord view={v} at={null} />)
    const k = screen.getByTestId('journey-commitment:501')
    expect(k).toHaveTextContent('Owner: Maya · review on 1 Dec 2026')
    // Codex NO-GO 2: the person's own expectation, and the model's band beside it, never one for the other (Team's words)
    expect(screen.getByTestId('journey-commitment:501-expect')).toHaveTextContent('What we expect: An invented expectation.')
    expect(screen.getByTestId('journey-commitment:501-band')).toHaveTextContent('The model’s band for it then: 1 to 3 months')
    expect(screen.getByTestId('journey-commitment:501-expect')).not.toHaveTextContent('1 to 3 months')
    expect(k).toHaveTextContent('Reconsider if: An invented reason to reconsider.')
    const o = screen.getByTestId('journey-outcome:601')
    expect(o).toHaveTextContent('An invented thing that happened. · 2 months')
    expect(o).toHaveTextContent(W.triggered)
    // the verdict in Team's words for core's code, never the code itself; a code Team does not know draws nothing
    expect(screen.getByTestId('journey-outcome:601-versus').textContent).toBe('Worse than expected')
    const odd = full({ collab: { ...base.collab, commitments: [COMMITMENT([{ ...OUTCOME, versus: 'not_a_code' }])], dissent: [], can_reveal: false } })
    expect(journeyOf(odd, CTX).commitments[0].outcomes[0].versus).toBeNull()
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
