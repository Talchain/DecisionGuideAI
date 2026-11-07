/**
 * Core's comparisons in the Analysis panel (DL R4, was R3: D2 on the middle figures, CHANGE 8 against carrying on; olumi.view/3
 * `model.run.compared`): each group under core's own heading (`compared_headings`, science-coaching's #2 slice, olumi-core
 * wip/science-unresolved 5b8cc6f60), never as "Worth checking first"; each line drawn once and verbatim; an unknown kind, or a group core
 * gives no heading for, draws nothing; the worth lines are unaffected. Lines and headings are core's own at 5b8cc6f60: the middle line
 * from its european v3 golden, the two better lines from its bakery-asked v3 golden, the headings from `COMPARED_HEADINGS`
 * (view/science.ts). No golden there carries an unresolved line (pricing's £7,000 tie is now met), so that one line is core's middle
 * template (view/science.ts) with core's unresolved value (run/middle.ts `STATUS_VALUE`).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import golden from '../golden/european.view.json'
import type { View, ViewModel } from '../client'
import { ViewReasoning } from '../ViewReasoning'

afterEach(cleanup)

const ROM = {"glyph": "◆", "title": "Rests on Olumi’s proposals"}
const COMPARED = [
  {"id": "F35", "kind": "middle", "line": "'Enter multiple European countries' · aim 'Reach 800 customers' · on the middle figures: 560 customers, misses it", "hover": "option: 'Enter multiple European countries'; aim: 'Reach 800 customers'; figures: the middle ones (every range at its most likely value); risks: none happening; outcome: 'Customer base' at its highest in the window 560 customers; target: >= 800 customers; status: misses it. It rests on Olumi's reading of the aim, not yet confirmed by them. It rests on Olumi's what-if ranges for 'New customers from existing markets', 'Broader-entry acquisition what-if', 'Post-entry churn what-if'. It rests on Olumi's proposed figures for 'Proposed comparison horizon', not yet confirmed by them. It rests on: Provisionally read 800 as the total active customer base reached at least once within twelve months, not 800 European customers or a requirement to sustain 800 thereafter; Churn means customer-count churn applied to the opening monthly customer base. Existing-market acquisition is held unchanged across options. New customers are added at period end, and one blended churn rate covers all markets; Read 6–12 months as the window for starting European sales. Before entry, incremental European acquisitions are zero; after entry, the selected average acquisition rate and churn what-if apply; Both expansion designs use the same broad post-entry churn stress range; there is no evidence yet that either design improves or worsens retention. Without entry, the observed 8% is held constant as a scenario assumption; For each proposed country, establish the applicable permissions, tax, data, consumer or sector rules and the cost and time needed to satisfy them before selling. Recording this prerequisite does not mean it is met. It leaves out: Customer growth and budget compliance do not establish profitability or adequate cash runway. The stated 12% warning is retained, but no probability of making or losing money is calculated; The calculation uses an average acquisition rate after entry; it does not model sales ramp, country-specific cohorts, regulatory delays beyond the entry window, or a later scale-up decision.", "aim": "reach_customer_target", "option": "broader_entry", "versus": null, "status": "missed", "olumi": ROM},
  {"id": "F12", "kind": "middle", "line": "'Raise the price by 45p' · aim 'Make £7,000 a month' · on the middle figures: £7,000/month, can't be told apart from the target", "hover": "status: unresolved", "aim": "profit_goal", "option": "raise_price", "versus": null, "status": "unresolved", "olumi": ROM},
  {"id": "F10", "kind": "better", "line": "'A second oven' against 'Carry on as now' · aim 'Sell at least 360 loaves a week' · better in over 99% of the same draws; improvement 36.6 loaves/week to 87.1 loaves/week, middle 70 loaves/week", "hover": "option: 'A second oven'; versus: 'Carry on as now'; aim: 'Sell at least 360 loaves a week'; outcome: 'sales'; direction: more is better; better in: over 99% of the same draws; improvement, 10th to 90th percentile: 36.6 loaves/week to 87.1 loaves/week; median improvement: 70 loaves/week. It rests on Olumi's what-if ranges for 'extra sold per oven'.", "aim": "sell_360", "option": "second_oven", "versus": "carry_on", "status": null, "olumi": ROM},
  {"id": "F11", "kind": "better", "line": "'Open two hours longer' against 'Carry on as now' · aim 'Sell at least 360 loaves a week' · better in over 99% of the same draws; improvement 39.5 loaves/week to 79.7 loaves/week, middle 60 loaves/week", "hover": "option: 'Open two hours longer'; versus: 'Carry on as now'; aim: 'Sell at least 360 loaves a week'; outcome: 'sales'; direction: more is better; better in: over 99% of the same draws; improvement, 10th to 90th percentile: 39.5 loaves/week to 79.7 loaves/week; median improvement: 60 loaves/week.", "aim": "sell_360", "option": "longer_hours", "versus": "carry_on", "status": null, "olumi": null},
  {"id": "F41", "kind": "later", "line": "a kind this page does not know", "hover": "", "aim": "g", "option": "o", "versus": null, "status": null, "olumi": null},
]
const HEADINGS = {"middle": "On the middle figures", "better": "Compared with carrying on", "unresolved": "Can't be told apart from the target"} // core's COMPARED_HEADINGS, verbatim
const withCompared = (compared: unknown[], headings: unknown): ViewModel => {
  const v = golden as unknown as View
  return { ...v.model!, run: { ...v.model!.run!, compared, compared_headings: headings } as never }
}

// The Reasoning tab holds core's worth and compared lines in its closed row "What would change your mind" (R25: ViewReasoning, parts.tsx
// SectionRow): they are in the DOM once the row is opened, as a reader opens it. A model with neither has no row to open.
const show = (model: ViewModel) => {
  const r = render(<ViewReasoning model={model} />)
  const toggle = screen.queryByTestId('view-reasoning-change-toggle')
  if (toggle !== null) fireEvent.click(toggle)
  return r
}

describe('core\'s comparisons, each under core\'s own heading for it', () => {
  it('each line is drawn once, verbatim, under its group\'s heading, in core\'s order; Olumi\'s mark when core gives one', () => {
    const { container } = show(withCompared(COMPARED, HEADINGS))
    const groups = [...screen.getByTestId('view-run-compared').querySelectorAll('[data-testid^="view-run-compared-"]')]
    expect(groups.map((g) => g.querySelector('p')!.textContent)).toEqual([HEADINGS.middle, HEADINGS.unresolved, HEADINGS.better])
    expect([...screen.getByTestId('view-run-compared-middle').querySelectorAll('[data-view-fact]')].map((d) => d.textContent)).toEqual([`◆ ${COMPARED[0]!.line}`])
    expect([...screen.getByTestId('view-run-compared-unresolved').querySelectorAll('[data-view-fact]')].map((d) => d.textContent)).toEqual([`◆ ${COMPARED[1]!.line}`])
    expect([...screen.getByTestId('view-run-compared-better').querySelectorAll('[data-view-fact]')].map((d) => d.textContent)).toEqual([`◆ ${COMPARED[2]!.line}`, COMPARED[3]!.line])
    for (const c of COMPARED.slice(0, 4)) {
      expect(container.textContent!.split(c.line).length - 1).toBe(1) // once on the panel
      expect(container.querySelector(`[data-view-fact="${c.id}"]`)!.getAttribute('title')).toBe(c.hover)
    }
  })
  it('each group sits apart from the next, in the panel\'s own rhythm (space-y-3 between groups; the Reasoning tab\'s sections are space-y-6 apart since R25)', () => {
    show(withCompared(COMPARED, HEADINGS))
    const panel = screen.getByTestId('view-reasoning'), box = screen.getByTestId('view-run-compared')
    expect(panel.classList.contains('space-y-6')).toBe(true)
    expect(box.classList.contains('space-y-3')).toBe(true)
  })
  it('an unknown kind draws nothing, and a group core gives no heading for draws nothing', () => {
    const { container } = show(withCompared(COMPARED, { middle: 'H middle', later: 'H later' })) // a heading for a kind this page does not know, too
    expect(container.textContent).not.toContain('a kind this page does not know')
    expect(container.textContent).not.toContain('H later')
    expect(screen.queryByTestId('view-run-compared-better')).toBeNull()
    expect(screen.queryByTestId('view-run-compared-unresolved')).toBeNull()
    for (const c of COMPARED.slice(2, 4)) expect(container.textContent).not.toContain(c.line)
    expect(screen.getByTestId('view-run-compared-middle')).toBeTruthy()
  })
  it('a core without compared (or without headings) draws no comparison at all', () => {
    show(withCompared(COMPARED, undefined))
    expect(screen.queryByTestId('view-run-compared')).toBeNull()
  })
  it('the worth lines are unaffected: "Worth checking first" holds core\'s science lines alone, never a compared one', () => {
    const plain = show((golden as unknown as View).model!)
    const before = screen.getByTestId('view-run-worth').textContent
    plain.unmount()
    show(withCompared(COMPARED, HEADINGS))
    expect(screen.getByTestId('view-run-worth').textContent).toBe(before)
    for (const c of COMPARED) expect(screen.getByTestId('view-run-worth').textContent).not.toContain(c.line)
  })
})
