/**
 * The scenario's record on the olumi-core lane (wip/v12-tab-journey): every line is one of core's records, bound by its id, newest first,
 * at the top of the history panel above core's versions (never repeating them). Fixture: the in-repo consulting-evidence View (two pieces of
 * evidence, three views given), with one commitment, one outcome, one kept idea and one `since` added by shape (invented words). Contrasts
 * in the same file.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../types'
import { useViewStore } from '../../../store'
import { useReveal } from '../../../reveal'
import { useUIStore } from '../../../../stores/uiStore'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { AT_REST, JOURNEY_WORDS, journeyOf } from '../journey'

const focused: string[] = []
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusNodeById: (id: string) => { focused.push(id) } }))

const { JourneyRecord } = await import('../JourneyRecord')
const { WhatChangedPanel } = await import('../../../../canvas/versions/WhatChangedPanel')

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11/consulting-evidence.view3.json'), 'utf8')) as View
const SINCE = {
  heading: 'Since the version before', from: { n: 1, label: 'version 1' }, to: { n: base.version!.n, label: 'version 2' },
  changed: [{ id: 'card_a', label: 'An invented factor', whose: 'theirs', was: null }, { id: 'card_b', label: 'An invented risk', whose: 'olumi', was: null }],
  sole: null, lines: [],
}
const COMMITMENT = {
  id: 501, at: '2026-11-07T17:00:00.000Z', by: 'Maya', by_id: 'm', action: 'An invented action to try first.', owner: 'Maya', owner_id: 'm',
  expect: '', reconsider: '', keeps: [], option: null, version: 2, expect_band: null, review_on: null, trigger: null,
  outcomes: [{ id: 601, at: '2026-11-08T09:00:00.000Z', by: 'Tom', by_id: 't', happened: 'An invented thing that happened.', versus: '', reconsider_triggered: false, note: null, figure: null, dissent: [] }],
}
const KEPT = [{ id: 1, turn: 2, text: 'An invented idea.', by: 'olumi', kept_by: { id: 'p', name: 'Priya' }, at: '2026-11-07T16:00:00Z', concerns: [] }]
const team = (extra: Partial<Record<string, unknown>> = {}): View => ({
  ...base,
  model: base.model === null ? null : { ...base.model, run: base.model.run === null ? null : { ...base.model.run, since: SINCE } },
  collab: { ...base.collab, commitments: [COMMITMENT] },
  kept: KEPT,
  proposal: null,
  ...extra,
} as unknown as View)

afterEach(() => { cleanup(); focused.length = 0; useReveal.getState().selectEvidence(null) })

describe('journeyOf: core records only, newest first, bound by id', () => {
  it('orders every record by core\'s own time, newest first, each keyed by its kind and core id; versions are not among them', () => {
    const j = journeyOf(team())
    expect(j.entries.map((e) => e.key)).toEqual(['outcome:601', 'commitment:501', 'evidence:29', 'evidence:28', 'kept:1'])
    expect(j.entries.find((e) => e.key === 'commitment:501')).toMatchObject({ line: 'Maya made a commitment', detail: COMMITMENT.action })
    expect(j.entries.find((e) => e.key === 'outcome:601')?.line).toBe(JOURNEY_WORDS.outcome('Tom'))
  })
  it('a kept idea is dated by its keep row, named as Olumi\'s, and points at its card on the canvas', () => {
    expect(journeyOf(team()).entries.find((e) => e.key === 'kept:1')).toMatchObject({ line: 'Olumi’s idea kept by Priya', detail: 'An invented idea.', target: { kind: 'card', id: 'idea:kept:1' } })
    // contrast: no kept rows, no kept line
    expect(journeyOf(team({ kept: [] })).entries.some((e) => e.kind === 'kept')).toBe(false)
  })
  it('"changed at version n" comes from `since` only when it is to the version shown; Olumi\'s card is marked as Olumi\'s', () => {
    expect(journeyOf(team()).changed).toEqual({ n: base.version!.n, cards: [{ id: 'card_a', label: 'An invented factor', olumi: false }, { id: 'card_b', label: 'An invented risk', olumi: true }] })
    // contrast: a `since` to another version, and no `since` at all, give none
    expect(journeyOf(team({ version: { ...base.version!, n: base.version!.n + 1 } })).changed).toBeNull()
    expect(journeyOf(base).changed).toBeNull()
  })
  it('views given stay a count (the View sends no time for them); a pending proposal is provisional, not a record', () => {
    const j = journeyOf(team())
    expect(j.views?.line).toBe('3 views given · Priya, Tom, Maya')
    expect(j.entries.some((e) => e.key.startsWith('view'))).toBe(false)
    expect(j.pending).toBe(false)
    expect(journeyOf(team({ proposal: { id: 9 } })).pending).toBe(true)
  })
  it('claims no stage: no line names STRATEGISE…IMPROVE', () => {
    const words = JSON.stringify(journeyOf(team()))
    for (const s of ['STRATEGISE', 'FRAME', 'IDEATE', 'EVALUATE', 'ACT', 'IMPROVE']) expect(words).not.toContain(s)
  })
})

describe('JourneyRecord: one press to the thing each line names, and the panel closes', () => {
  beforeEach(() => { useViewStore.setState({ uuid: 'u', sid: base.id, view: team(), status: 'ready', error: null, stale: false, at: null }) })
  it('a changed card\'s chip and a kept idea put the card in front; evidence opens that piece in Team; a commitment opens Team; each press closes', async () => {
    const done = vi.fn()
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    render(<JourneyRecord view={team()} onDone={done} />)
    expect(screen.getByTestId('journey-card-card_b')).toHaveAttribute('data-olumi', 'true')
    expect(screen.getByTestId('journey-card-card_a')).not.toHaveAttribute('data-olumi')
    fireEvent.click(screen.getByTestId('journey-card-card_b'))
    await waitFor(() => expect(focused).toEqual(['card_b']))
    fireEvent.click(screen.getByTestId('journey-go-kept:1'))
    await waitFor(() => expect(focused).toEqual(['card_b', 'idea:kept:1']))
    fireEvent.click(screen.getByTestId('journey-go-evidence:28'))
    await waitFor(() => expect(useReveal.getState().evidence).toBe(28))
    expect(force).toHaveBeenLastCalledWith('team')
    fireEvent.click(screen.getByTestId('journey-go-commitment:501'))
    await waitFor(() => expect(force).toHaveBeenCalledTimes(2))
    expect(done).toHaveBeenCalledTimes(4)
  })
  it('at rest only the newest few lines; the rest behind one press', () => {
    const many = Array.from({ length: AT_REST + 2 }, (_, i) => ({ ...KEPT[0]!, id: 10 + i, at: `2026-11-0${1 + (i % 8)}T10:00:00Z` }))
    render(<JourneyRecord view={team({ kept: many })} />)
    expect(screen.getByTestId('journey-rail').children).toHaveLength(AT_REST)
    fireEvent.click(screen.getByTestId('journey-all'))
    expect(screen.getByTestId('journey-rail').children).toHaveLength(4 + many.length)
  })
  it('a View with nothing to record draws nothing (the panel is then core\'s versions alone)', () => {
    const empty = { ...base, model: null, collab: { ...base.collab, commitments: [], shared: [], dissent: [] }, evidence: [], kept: [], proposal: null } as unknown as View
    const { container } = render(<JourneyRecord view={empty} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('the history panel on the lane: the record above core\'s versions, said once', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    setTeamFetch((async () => new Response(JSON.stringify({ versions: [{ id: 41, n: 1, at: '2026-11-07T10:00:00Z', by: 'Priya', base: null }] }), { status: 200 })) as unknown as typeof fetch)
    useViewStore.setState({ uuid: 'u', sid: 's_0123456789ab', view: team(), status: 'ready', error: null, stale: false, at: null })
  })
  afterEach(() => { setTeamFetch(null); vi.unstubAllEnvs() })
  it('draws the record first, then core\'s versions; no version line is in the record', async () => {
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('core-versions')).toBeTruthy())
    const record = screen.getByTestId('journey-record')
    expect(record.compareDocumentPosition(screen.getByTestId('core-versions')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(record).not.toHaveTextContent(/Version \d/)
  })
  it('off the lane the panel is the local history as before, with no record', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    expect(screen.queryByTestId('journey-record')).toBeNull()
    expect(screen.getByTestId('versions-vocabulary-disclosure')).toBeTruthy()
  })
})
