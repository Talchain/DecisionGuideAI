/**
 * The Journey tab on the olumi-core lane (wip/v12-tab-journey): every line is one of core's records, bound by its id, newest first; the
 * strip offers Journey on the lane and nowhere else. Fixture: the in-repo consulting-evidence View (two pieces of evidence, three views
 * given), with stored versions, one commitment, one outcome and one `since` added by shape (invented words). Contrasts in the same file.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../types'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { AT_REST, JOURNEY_WORDS, journeyOf, type StoredVersion } from '../journey'

const calls: string[] = []
let answer: { versions: StoredVersion[] } | Error = { versions: [] }
vi.mock('../../../../olumiCore/team/api', () => ({
  call: async (_m: string, url: string) => { calls.push(url); if (answer instanceof Error) throw answer; return answer },
}))
const focused: string[] = []
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusNodeById: (id: string) => { focused.push(id) } }))
import { useReveal } from '../../../reveal'

const { JourneyTab } = await import('../JourneyTab')

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11/consulting-evidence.view3.json'), 'utf8')) as View
const VERSIONS: StoredVersion[] = [
  { n: 1, at: '2026-11-07T10:00:00.000Z', by: 'Priya' },
  { n: 2, at: '2026-11-07T15:00:00.000Z', by: 'Tom' },
]
const SINCE = {
  heading: 'Since the version before', from: { n: 1, label: 'version 1' }, to: { n: 2, label: 'version 2' },
  changed: [{ id: 'card_a', label: 'An invented factor', whose: 'theirs', was: null }, { id: 'card_b', label: 'An invented risk', whose: 'olumi', was: null }],
  sole: null, lines: [],
}
const COMMITMENT = {
  id: 501, at: '2026-11-07T17:00:00.000Z', by: 'Maya', by_id: 'm', action: 'An invented action to try first.', owner: 'Maya', owner_id: 'm',
  expect: '', reconsider: '', keeps: [], option: null, version: 2, expect_band: null, review_on: null, trigger: null,
  outcomes: [{ id: 601, at: '2026-11-08T09:00:00.000Z', by: 'Tom', by_id: 't', happened: 'An invented thing that happened.', versus: '', reconsider_triggered: false, note: null, figure: null, dissent: [] }],
}
const team = (): View => ({
  ...base,
  model: base.model === null ? null : { ...base.model, run: base.model.run === null ? null : { ...base.model.run, since: SINCE } },
  collab: { ...base.collab, commitments: [COMMITMENT] },
} as unknown as View)

afterEach(() => { cleanup(); calls.length = 0; focused.length = 0; answer = { versions: [] }; useReveal.getState().selectEvidence(null) })

describe('journeyOf: core records only, newest first, bound by id', () => {
  it('orders every record by core\'s own time, newest first, each keyed by its kind and core id', () => {
    const j = journeyOf(team(), VERSIONS)
    expect(j.entries.map((e) => e.key)).toEqual(['outcome:601', 'commitment:501', 'evidence:29', 'evidence:28', 'version:2', 'version:1'])
    expect(j.entries.find((e) => e.key === 'version:2')?.line).toBe('Version 2 approved by Tom')
    expect(j.entries.find((e) => e.key === 'commitment:501')?.detail).toBe(COMMITMENT.action)
    expect(j.entries.find((e) => e.key === 'outcome:601')?.line).toBe(JOURNEY_WORDS.outcome('Tom'))
  })
  it('"what changed" sits on the version `since` is to, never on another; Olumi\'s card is marked as Olumi\'s', () => {
    const j = journeyOf(team(), VERSIONS)
    expect(j.entries.find((e) => e.key === 'version:2')?.changed).toEqual([
      { id: 'card_a', label: 'An invented factor', olumi: false }, { id: 'card_b', label: 'An invented risk', olumi: true },
    ])
    // contrast: version 1 carries none, and a View with no `since` gives none anywhere
    expect(j.entries.find((e) => e.key === 'version:1')?.changed).toEqual([])
    expect(journeyOf(base, VERSIONS).entries.every((e) => e.changed.length === 0)).toBe(true)
  })
  it('the top line is the View\'s own version, with the approver only where core\'s stored versions name one', () => {
    expect(journeyOf(team(), VERSIONS).where).toMatchObject({ n: 2, by: 'Tom', at: '2026-11-07T15:00:00.000Z' })
    // contrast: before the versions read answers, no approver is named and no stored version is invented
    const cold = journeyOf(team(), null)
    expect(cold.where).toMatchObject({ n: 2, by: null })
    expect(cold.entries.filter((e) => e.kind === 'version').map((e) => e.key)).toEqual(base.version?.at === undefined ? [] : ['version:2'])
  })
  it('a kept idea is dated by its keep row and named as Olumi\'s; views given stay a count (the View sends no time for them)', () => {
    const kept = [{ id: 1, turn: 2, text: 'An invented idea.', by: 'olumi', kept_by: { id: 'p', name: 'Priya' }, at: '2026-11-07T11:00:00Z', concerns: [] }]
    const j = journeyOf({ ...team(), kept } as unknown as View, VERSIONS)
    const e = j.entries.find((x) => x.key === 'kept:1')
    expect(e).toMatchObject({ line: 'Olumi’s idea kept by Priya', detail: 'An invented idea.', target: { kind: 'card', id: 'idea:kept:1' } })
    expect(j.entries.map((x) => x.key).indexOf('kept:1')).toBe(j.entries.map((x) => x.key).indexOf('version:1') - 1)
    expect(j.counts.map((c) => c.line)).toEqual(['3 views given · Priya, Tom, Maya'])
    expect(j.entries.some((x) => x.key.startsWith('view'))).toBe(false)
    // contrast: no kept rows, no kept line
    expect(journeyOf(team(), VERSIONS).entries.some((x) => x.kind === 'kept')).toBe(false)
  })
  it('an Olumi proposal not yet approved is provisional, said once at the top, never a record', () => {
    expect(journeyOf({ ...team(), proposal: { id: 9 } } as unknown as View, VERSIONS).pending).toBe(true)
    expect(journeyOf({ ...team(), proposal: null } as unknown as View, VERSIONS).pending).toBe(false)
  })
  it('claims no stage: no line names STRATEGISE…IMPROVE', () => {
    const words = JSON.stringify(journeyOf(team(), VERSIONS))
    for (const s of ['STRATEGISE', 'FRAME', 'IDEATE', 'EVALUATE', 'ACT', 'IMPROVE']) expect(words).not.toContain(s)
  })
  it('before version 1 there is no journey to draw', () => {
    expect(journeyOf({ ...base, version: null } as unknown as View, null).where).toBeNull()
  })
})

describe('JourneyTab: one press to the thing each line names', () => {
  const show = (view: View, at: number | null = null) => {
    const look = vi.fn(async () => null)
    useViewStore.setState({ uuid: 'u', sid: view.id, view, status: 'ready', error: null, stale: false, at, look } as never)
    return look
  }
  it('reads core\'s stored versions for this scenario and draws a version on the canvas when its line is pressed', async () => {
    answer = { versions: VERSIONS }
    const view = team(); const look = show(view)
    render(<JourneyTab view={view} sid={view.id} at={null} />)
    await screen.findByTestId('journey-entry-version:1')
    expect(calls).toEqual([`/api/scenarios/${encodeURIComponent(view.id)}/versions`])
    expect(screen.getByTestId('journey-where')).toHaveTextContent('Version 2 · approved by Tom')
    fireEvent.click(screen.getByTestId('journey-go-version:1'))
    expect(look).toHaveBeenCalledWith(1)
    // contrast: the latest version's press draws the latest (null), not a numbered earlier one
    fireEvent.click(screen.getByTestId('journey-go-version:2'))
    expect(look).toHaveBeenLastCalledWith(null)
  })
  it('a changed card\'s chip puts that card in front; evidence opens that piece; a commitment opens the Team tab', async () => {
    answer = { versions: VERSIONS }
    const view = team(); show(view)
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    render(<JourneyTab view={view} sid={view.id} at={null} />)
    await screen.findByTestId('journey-entry-version:1')
    fireEvent.click(screen.getByTestId('journey-card-card_b'))
    expect(focused).toEqual(['card_b'])
    expect(screen.getByTestId('journey-card-card_b')).toHaveAttribute('data-olumi', 'true')
    expect(screen.getByTestId('journey-card-card_a')).not.toHaveAttribute('data-olumi')
    fireEvent.click(screen.getByTestId('journey-go-evidence:28'))
    await waitFor(() => expect(useReveal.getState().evidence).toBe(28))
    expect(force).toHaveBeenLastCalledWith('team')
    fireEvent.click(screen.getByTestId('journey-go-commitment:501'))
    expect(force).toHaveBeenCalledWith('team')
  })
  it('at rest only the newest few lines; the rest behind one press', async () => {
    answer = { versions: [...VERSIONS, { n: 3, at: '2026-11-09T10:00:00.000Z', by: 'Maya' }] }
    const view = team(); show(view)
    render(<JourneyTab view={view} sid={view.id} at={null} />)
    await screen.findByTestId('journey-entry-version:3')
    expect(screen.getByTestId('journey-rail').children).toHaveLength(AT_REST)
    fireEvent.click(screen.getByTestId('journey-all'))
    expect(screen.getByTestId('journey-rail').children).toHaveLength(7)
  })
  it('a failed versions read still draws the View\'s own version, naming nobody', async () => {
    answer = new Error('down')
    const view = team(); show(view)
    render(<JourneyTab view={view} sid={view.id} at={null} />)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(screen.getByTestId('journey-where')).toHaveTextContent(/^Version 2/)
    expect(screen.getByTestId('journey-where')).not.toHaveTextContent('approved by')
  })
})
