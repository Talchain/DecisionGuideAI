/**
 * Core's comparisons in the Analysis panel (DL R3: D2 on the middle figures, CHANGE 8 against carrying on; olumi.view/3
 * `model.run.compared`, olumi-core wip/science-d2 e469ec168): each group under core's own heading (`compared_headings`, science-coaching's
 * #2 slice), never as "Worth checking first"; each line drawn once and verbatim; an unknown kind, or a group core gives no heading for,
 * draws nothing; the worth lines are unaffected. The lines are core's own, from its v3 goldens at e469ec168 (european, pricing); the
 * better line is API.md's own template, since no golden carries one yet.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import golden from '../golden/european.view.json'
import type { View, ViewModel } from '../client'
import { ViewReasoning } from '../ViewReasoning'

afterEach(cleanup)

const ROM = { glyph: '◆', title: 'Rests on Olumi’s proposals' }
const COMPARED = [
  { id: 'F35', kind: 'middle', line: "'Enter multiple European countries' · aim 'Reach 800 customers' · on the middle figures: 560 customers, misses it", hover: 'option: ...; status: missed', aim: 'goal_customers', option: 'multi', versus: null, status: 'missed', olumi: ROM },
  { id: 'F12', kind: 'middle', line: "'Raise the price by 45p' · aim 'Make £7,000 a month' · on the middle figures: £7,000/month, can't be told apart from the target", hover: 'status: unresolved', aim: 'g', option: 'raise', versus: null, status: 'unresolved', olumi: ROM },
  { id: 'F40', kind: 'better', line: "'Enter multiple European countries' against 'No new European entry during this window' · aim 'Reach 800 customers' · better in about 90% of the same draws; improvement 12 customers to 140 customers, middle 60 customers", hover: 'option; versus; better in …', aim: 'goal_customers', option: 'multi', versus: 'none', status: null, olumi: null },
  { id: 'F41', kind: 'later', line: 'a kind this page does not know', hover: '', aim: 'g', option: 'o', versus: null, status: null, olumi: null },
]
const HEADINGS = { middle: 'H middle', better: 'H better', unresolved: 'H unresolved' }
const withCompared = (compared: unknown[], headings: unknown): ViewModel => {
  const v = golden as unknown as View
  return { ...v.model!, run: { ...v.model!.run!, compared, compared_headings: headings } as never }
}

describe('core\'s comparisons, each under core\'s own heading for it', () => {
  it('each line is drawn once, verbatim, under its group\'s heading, in core\'s order; Olumi\'s mark when core gives one', () => {
    const { container } = render(<ViewReasoning model={withCompared(COMPARED, HEADINGS)} />)
    const groups = [...screen.getByTestId('view-run-compared').querySelectorAll('[data-testid^="view-run-compared-"]')]
    expect(groups.map((g) => g.querySelector('p')!.textContent)).toEqual(['H middle', 'H unresolved', 'H better'])
    expect([...screen.getByTestId('view-run-compared-middle').querySelectorAll('[data-view-fact]')].map((d) => d.textContent)).toEqual([`◆ ${COMPARED[0]!.line}`])
    expect([...screen.getByTestId('view-run-compared-unresolved').querySelectorAll('[data-view-fact]')].map((d) => d.textContent)).toEqual([`◆ ${COMPARED[1]!.line}`])
    expect([...screen.getByTestId('view-run-compared-better').querySelectorAll('[data-view-fact]')].map((d) => d.textContent)).toEqual([COMPARED[2]!.line])
    for (const c of COMPARED.slice(0, 3)) {
      expect(container.textContent!.split(c.line).length - 1).toBe(1) // once on the panel
      expect(container.querySelector(`[data-view-fact="${c.id}"]`)!.getAttribute('title')).toBe(c.hover)
    }
  })
  it('an unknown kind draws nothing, and a group core gives no heading for draws nothing', () => {
    const { container } = render(<ViewReasoning model={withCompared(COMPARED, { middle: 'H middle', later: 'H later' })} />) // a heading for a kind this page does not know, too
    expect(container.textContent).not.toContain('a kind this page does not know')
    expect(container.textContent).not.toContain('H later')
    expect(screen.queryByTestId('view-run-compared-better')).toBeNull()
    expect(screen.queryByTestId('view-run-compared-unresolved')).toBeNull()
    expect(container.textContent).not.toContain(COMPARED[2]!.line)
    expect(screen.getByTestId('view-run-compared-middle')).toBeTruthy()
  })
  it('a core without compared (or without headings) draws no comparison at all', () => {
    render(<ViewReasoning model={withCompared(COMPARED, undefined)} />)
    expect(screen.queryByTestId('view-run-compared')).toBeNull()
  })
  it('the worth lines are unaffected: "Worth checking first" holds core\'s science lines alone, never a compared one', () => {
    const plain = render(<ViewReasoning model={(golden as unknown as View).model!} />)
    const before = screen.getByTestId('view-run-worth').textContent
    plain.unmount()
    render(<ViewReasoning model={withCompared(COMPARED, HEADINGS)} />)
    expect(screen.getByTestId('view-run-worth').textContent).toBe(before)
    for (const c of COMPARED) expect(screen.getByTestId('view-run-worth').textContent).not.toContain(c.line)
  })
})
