/**
 * SCI-HISTORY in the Team tab (core 2a5f61f7, `differences[].earlier`): two people kept a disagreement on version 3 (Workshop 6 days, Tomasz
 * 8 days); a shared edit made version 4. The version-3 entry is drawn as HISTORY, read-only, after the current entries, and the current entry
 * in the same payload keeps its controls and draws as it did before. Fixtures: core's own reads, dumped by the science owner from its temp
 * Store (output/ui-restore-20261111/history/, byte for byte): the live read after both re-gave on version 4 (one current entry and one
 * history entry, same figure and aim) and the cold reopen as Workshop (history only). Bound by identity: the record, the aim and
 * `earlier.version`, never a value another entry could satisfy.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { setTeamFetch } from '../team/api'
import { resetWrites } from '../team/writes'
import { differencesShape, resetDifferences, type Difference } from '../team/differences'
import { DifferencesPanel } from '../team/DifferencesPanel'

const read = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate', f), 'utf8'))
const live = read('differences.history-v4.core.json')
const cold = read('differences.history-v4-cold.core.json')
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', 'effects.view3.json'), 'utf8'))
const view = (): View => ({ ...fx, gated: false, you_id: '1' } as View)
const serve = (body: unknown) => setTeamFetch((async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)
afterEach(() => { cleanup(); setTeamFetch(null); resetWrites(); resetDifferences() })

const RECORD = 'current_average_wait_for_a_repair', GOAL = 'average_repair_wait_under_5_days'
const CURRENT = `team-difference-${RECORD}-${GOAL}`, EARLIER = `${CURRENT}-v3`
const entryOf = (body: { differences: Difference[] }, earlier: number | null) =>
  body.differences.find((d) => d.record === RECORD && d.goal === GOAL && (earlier === null ? d.earlier === undefined : d.earlier?.version === earlier))!
const CONTROLS = ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox', 'switch', 'menuitem'] as const
const controlsIn = (el: HTMLElement) => CONTROLS.flatMap((r) => within(el).queryAllByRole(r))

describe('a disagreement kept on an earlier version, after a shared edit', () => {
  it('the payloads are the case: one figure and aim, current on version 4 and history on version 3 with its kept receipt', () => {
    expect(live.version).toBe(4)
    const now = entryOf(live, null), was = entryOf(live, 3)
    expect(now.sides.map((s) => s.figure)).toEqual(['6 days', '7 days'])
    expect(was.sides.map((s) => s.figure)).toEqual(['6 days', '8 days'])
    expect(was.steps.map((s) => [s.step, s.version])).toEqual([['dissent', 3]])
    expect(differencesShape(live)!.differences.filter((d) => d.earlier?.version === 3)).toHaveLength(1)
  })

  it('the version-3 entry has nothing to press; the version-4 entry in the same read keeps its steps', async () => {
    serve(live)
    render(<DifferencesPanel sid={live.scenario} view={view()} onWrote={async () => true} />)
    const was = await screen.findByTestId(EARLIER), now = screen.getByTestId(CURRENT)
    const w = entryOf(live, 3), h = live.headings
    expect(was.getAttribute('data-difference-earlier')).toBe('3')
    expect(controlsIn(was)).toEqual([])
    // Drawn as core gives it, labelled with its version: figures, each holder's chance, its version's model column, the kept receipt.
    expect(within(was).getByTestId(`${EARLIER}-version`).textContent).toBe('Version 3')
    expect(within(was).getByTestId(`${EARLIER}-status`).textContent).toBe(w.status_text)
    expect(w.status_text.startsWith(w.earlier!.text)).toBe(true)
    expect([...was.querySelectorAll('[data-difference-figure]')].map((e) => e.textContent)).toEqual(['Workshop: 6 days', 'Tomasz: 8 days'])
    for (const o of w.options) {
      const row = was.querySelector(`[data-difference-option="${o.option}"]`)!
      expect(o.chances.map((c) => row.querySelector(`[data-difference-chance="${c.holder_id}"]`)!.textContent)).toEqual(o.chances.map((c) => c.text))
      expect(row.querySelector('[data-difference-model]')!.textContent).toBe(o.model)
    }
    expect(was.textContent).not.toContain(h.model)
    expect([...was.querySelectorAll('[data-step]')].map((e) => [e.textContent, e.getAttribute('data-step-version')])).toEqual(w.steps.map((s) => [s.text, '3']))
    expect(was.textContent).not.toContain('Preview on the canvas')
    // The current entry keeps its own controls (core's words), and is the one a step is taken on.
    const names = within(now).getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual(expect.arrayContaining([h.dissent, h.research, h.commit]))
    expect(now.hasAttribute('data-difference-earlier')).toBe(false)
    // History sits after every current entry.
    expect(now.compareDocumentPosition(was) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the current entry draws byte for byte as it does in the same read without history', async () => {
    serve(live)
    const a = render(<DifferencesPanel sid={live.scenario} view={view()} onWrote={async () => true} />)
    const withHistory = (await a.findByTestId(CURRENT)).outerHTML
    cleanup(); resetDifferences()
    serve({ ...live, differences: live.differences.filter((d: Difference) => d.earlier === undefined) })
    const b = render(<DifferencesPanel sid={live.scenario} view={view()} onWrote={async () => true} />)
    expect((await b.findByTestId(CURRENT)).outerHTML).toBe(withHistory)
    expect(b.queryByTestId(EARLIER)).toBeNull()
  })

  it('reopened cold, with only the history entry, it is still drawn, read-only, and not as "nothing differs"', async () => {
    serve(cold)
    render(<DifferencesPanel sid={cold.scenario} view={view()} onWrote={async () => true} />)
    const was = await screen.findByTestId(EARLIER)
    expect(controlsIn(was)).toEqual([])
    expect(screen.queryByTestId(CURRENT)).toBeNull()
    expect(screen.queryByTestId('team-differences-empty')).toBeNull()
  })

  it('an entry whose `earlier` is not core\'s shape is dropped, never drawn as a current entry with steps', () => {
    const bad = { ...live, differences: live.differences.map((d: Difference) => (d.earlier ? { ...d, earlier: { version: '3', text: d.earlier.text } } : d)) }
    const got = differencesShape(bad)!.differences
    expect(got.map((d) => [d.record, d.earlier])).toEqual([[RECORD, undefined]])
    expect(got[0]!.sides.map((s) => s.figure)).toEqual(['6 days', '7 days'])
  })
})
