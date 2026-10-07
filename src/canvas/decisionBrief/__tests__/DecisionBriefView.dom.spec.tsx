/**
 * The brief view shows a graph element when its item is pressed — bound by node id, never by label — and renders no
 * Run figure when the Run is not current. Driven by the builder's output on served reads.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

import currentRead from '../../hydrate/__tests__/fixtures/served-520aab46-cold.read.json'
import staleRead from '../../hydrate/__tests__/fixtures/served-6b2b94dd-stale.read.json'
import identityWithheldRead from '../../hydrate/__tests__/fixtures/served-0c238873-7f1be5d8.read.json'
import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { buildDecisionBrief, DECISION_BRIEF_COPY } from '../buildDecisionBrief'
import { decisionBriefToHtml } from '../decisionBriefHtml'
import { DecisionBriefView } from '../DecisionBriefView'

async function briefOf(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200, headers: new Headers(), json: async () => JSON.parse(JSON.stringify(body)),
  }) as unknown as Response))
  const r = await fetchScenarioGraph('00000000-0000-4000-8000-000000000001', { retryDelayMs: 0 })
  if (r.status !== 'graph') throw new Error(r.status)
  return buildDecisionBrief(r)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DecisionBriefView', () => {
  it('pressing a driver shows THAT node: the handler receives the driver’s node id', async () => {
    const brief = await briefOf(currentRead)
    const onShowNode = vi.fn()
    render(<DecisionBriefView brief={brief} onShowNode={onShowNode} />)

    const drivers = screen.getAllByTestId('brief-driver')
    expect(drivers.length).toBe(brief.drivers.length)
    fireEvent.click(drivers[1])
    expect(onShowNode).toHaveBeenCalledTimes(1)
    expect(onShowNode).toHaveBeenCalledWith(brief.drivers[1].nodeId)
    expect(drivers[1].getAttribute('data-node-id')).toBe(brief.drivers[1].nodeId)
  })

  it('pressing a withheld limit shows the limited factor', async () => {
    const brief = await briefOf(currentRead)
    const onShowNode = vi.fn()
    render(<DecisionBriefView brief={brief} onShowNode={onShowNode} />)
    const item = screen.getAllByTestId('brief-withheld-item').find((el) => el.textContent?.includes('Checked only against'))
    expect(item).toBeDefined()
    fireEvent.click(item!)
    expect(onShowNode).toHaveBeenCalledWith('monthly_churn')
  })

  it('a stale Run renders its statement and no chances or drivers, in the panel and the print page', async () => {
    const brief = await briefOf(staleRead)
    render(<DecisionBriefView brief={brief} onShowNode={vi.fn()} />)
    expect(screen.getByTestId('decision-brief').getAttribute('data-run-status')).toBe('not_current')
    expect(screen.queryByTestId('brief-chances')).toBeNull()
    expect(screen.queryByTestId('brief-drivers')).toBeNull()
    expect(screen.getByTestId('decision-brief').textContent).not.toMatch(/chance of meeting your goal/)
    expect(decisionBriefToHtml(brief)).not.toMatch(/chance of meeting your goal/)
  })

  it('a current Run where no option has a figure says so ONCE (panel and print), not a "no figure" row per option', async () => {
    const brief = await briefOf(identityWithheldRead)
    render(<DecisionBriefView brief={brief} onShowNode={vi.fn()} />)
    expect(screen.getByTestId('decision-brief').getAttribute('data-run-status')).toBe('current')
    expect(screen.queryByTestId('brief-chances')).toBeNull()
    expect(screen.getByTestId('brief-chances-note').textContent).toBe(DECISION_BRIEF_COPY.noChances)
    expect(screen.getByTestId('decision-brief').textContent).not.toContain(DECISION_BRIEF_COPY.noFigure)
    expect(decisionBriefToHtml(brief)).toContain('The reasons are below.')
    // CONTRAST: a Run with figures shows its rows and no note.
    cleanup()
    render(<DecisionBriefView brief={await briefOf(currentRead)} onShowNode={vi.fn()} />)
    expect(screen.getByTestId('brief-chances')).toBeTruthy()
    expect(screen.queryByTestId('brief-chances-note')).toBeNull()
  })

  it('a decision on record renders as its own section with the storage sentence; none → no section', async () => {
    const base = await briefOf(currentRead)
    const record = { heading: 'Decision recorded', position: 'Keep the £49 price', rows: [{ label: 'Because', text: 'Churn risk' }],
      recordedOn: 'Recorded 2 Oct 2026', storage: 'On this device, for this scenario.', yourView: 'Your view, not an agreed team decision.' }
    render(<DecisionBriefView brief={{ ...base, record }} onShowNode={vi.fn()} />)
    expect(screen.getByTestId('brief-record-position').textContent).toBe('Keep the £49 price')
    expect(screen.getByTestId('brief-record-storage').textContent).toBe(
      'Recorded 2 Oct 2026. On this device, for this scenario. Your view, not an agreed team decision.')
    cleanup()
    render(<DecisionBriefView brief={{ ...base, record: null }} onShowNode={vi.fn()} />)
    expect(screen.queryByTestId('brief-record')).toBeNull()
  })

  it('the print page escapes model text', async () => {
    const brief = await briefOf(currentRead)
    const html = decisionBriefToHtml({ ...brief, decision: { nodeId: null, label: '<script>x</script>' } })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})
