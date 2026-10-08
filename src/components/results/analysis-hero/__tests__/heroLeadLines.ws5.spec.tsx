import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../../v5/applyV5State'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { AnalysisHeroContainer } from '../AnalysisHeroContainer'
import { buildHeroModel } from '../buildHeroModel'
import { optionChanceCellFromResults } from '../../optionChanceCellFromResults'
import { OPTION_CHANCE_WITHHELD, buildRunView } from '../../../../canvas/runView/runView'
import { OLUMI_PROPOSED_EXCLUDED_COPY } from '../../utils/notAnalysedCopy'
import turn from './fixtures/p45-b1-0eba01bb-run2-turn.json'
import bodies from '../../../../canvas/runView/__tests__/fixtures/cee-canonical-view-bodies-283b8a98.json'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/analysis/canonicalRunRegistry', () => ({ executeCanonicalRun: vi.fn() }))
afterEach(() => { cleanup(); useCanvasStore.getState().resetCanvas?.() })
function hydrate(envelope = turn) {
  useCanvasStore.getState().resetCanvas?.()
  useCanvasStore.setState({ nodes: envelope.draft_graph.nodes.map(n => ({
    id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { ...n },
  })), edges: [] } as never)
  const snapshot = useCanvasStore.getState()
  applyV5State(envelope as unknown as OlumiResponse, {
    ...snapshot, currentResultsHash: snapshot.results?.hash ?? null,
  } as unknown as V5ApplicatorStore)
  expect(useCanvasStore.getState().results.report).toBeTruthy()
  return renderHook(() => useResultsSectionData()).result.current
}
function mounted(data: ReturnType<typeof hydrate>) {
  const model = buildHeroModel(data)
  console.info('LEAD-MODEL', JSON.stringify({ kind: model.kind, ...model.kind === 'chart' ? { subline: model.subline, coverage: model.goalOptionCoverage } : {} }))
  render(<AnalysisHeroContainer data={data} fragileEdgeCount={0} />)
  return screen.getByTestId('hero-subline')
}
describe('WS5 hero lead lines', () => {
  it('L1-REAL untouched P45 B1 turn: labelled own cells and one separate placeholder message', () => {
    const data = hydrate()
    const block = mounted(data)
    const lines = Array.from(block.querySelectorAll('p'))
    // A paragraph containing the old glued string is also a line, so this catches staging before the new layout.
    if (!lines.length) lines.push(block as HTMLParagraphElement)
    for (const line of lines.filter(n => /\d+%/.test(n.textContent ?? ''))) {
      expect(line.textContent).toContain('Carry on as now')
      expect(line.textContent).not.toContain('This comparison turns on')
    }
    expect(block.textContent).toContain('about 17%')
    expect((screen.getByTestId('analysis-hero-panel').textContent!.match(/This comparison turns on/g) ?? []).length).toBeLessThanOrEqual(1)
    expect((block.textContent!.match(/This comparison turns on/g) ?? [])).toHaveLength(1)
    const cell = optionChanceCellFromResults(data, 'carry_on_as_now')
    expect(lines.find(n => n.textContent?.includes('about 17%'))!.textContent).toBe(
      cell.text!.includes('Carry on as now') ? cell.text : `‘Carry on as now’: ${cell.text}`)
    console.info('L1-REAL', JSON.stringify(lines.map(n => n.textContent)))
  })
  it('L2 mixed B1: licensed, withheld face/why, excluded own cell and no unlabelled line', () => {
    const data = hydrate()
    const report = useCanvasStore.getState().results.report!
    const canonical = { ...bodies.a_current, run: { ...bodies.a_current.run, run_id: 'same' }, options: [
      { option_id: 'carry_on_as_now', cell: { kind: 'figure', display: 'about 17%' }, main_driver: { kind: 'not_recorded' } },
      { option_id: 'raise_pro_price_to_59', cell: { kind: 'withheld', face: OPTION_CHANCE_WITHHELD, why: turn.blocks[0].enrichment.inference_warnings.find(w => w.code === 'GOAL_FIGURES_TARGET_NOT_TESTABLE')!.message }, main_driver: { kind: 'not_recorded' } },
      { option_id: 'raise_pro_price_to_54', cell: { kind: 'withheld', face: OLUMI_PROPOSED_EXCLUDED_COPY }, main_driver: { kind: 'not_recorded' } },
    ] }
    data.runView = buildRunView({ ...report, run_id: 'same' }, canonical as never)
    const block = mounted(data)
    for (const option of data.recommendation.allOptions) {
      const line = block.querySelector(`[data-option-id="${option.id}"]`)
      expect(line, option.id).toBeTruthy()
      expect(line!.querySelector('span')!.textContent).toBe(`‘${option.label}’: ${optionChanceCellFromResults(data, option.id).text}`)
      expect(line!.textContent).not.toContain(option.id === 'carry_on_as_now' ? 'This comparison turns on' : 'about 17%')
    }
    const withheld = block.querySelector('[data-option-id="raise_pro_price_to_59"]')!
    expect(withheld.textContent).not.toContain('Roughly how much')
    fireEvent.click(withheld.querySelector('button')!)
    expect(withheld.textContent).toContain(canonical.options[1].cell.why)
    console.info('L2', block.textContent)
  })
  it.each(['licence', 'canonical'] as const)('L3 %s: P45 with a licensed driver keeps it after its own cell, with no matrix', source => {
    // Explicit control: the P45 capture itself has no licensed driver for Carry on.
    const claim = { quantity_id: 'pro_subscribers_today->pro_subscribers_at_month_12', kind: 'link_strength',
      from: 'pro_subscribers_today', to: 'pro_subscribers_at_month_12', side: 'low', strength: 'weaker',
      authored_by: 'user', user_stated_link: true }
    const envelope = structuredClone(turn)
    if (source === 'licence') {
      const licence = envelope.blocks[0].enrichment.inference_warnings.find(w => w.code === 'GOAL_CHANCE_LICENSED')!
      Object.assign(licence, { driver_by_option: { carry_on_as_now: claim }, no_driver_by_option: {} })
    }
    const data = hydrate(envelope)
    if (source === 'canonical') {
      const canonical = { ...bodies.a_current, run: { ...bodies.a_current.run, run_id: 'same' }, options: [
        { option_id: 'carry_on_as_now', cell: { kind: 'figure', display: 'about 17%' }, main_driver: { kind: 'available', driver: claim } },
        { option_id: 'raise_pro_price_to_59', cell: { kind: 'withheld', face: OPTION_CHANCE_WITHHELD }, main_driver: { kind: 'not_recorded' } },
        { option_id: 'raise_pro_price_to_54', cell: { kind: 'withheld', face: OLUMI_PROPOSED_EXCLUDED_COPY }, main_driver: { kind: 'not_recorded' } },
      ] }
      data.runView = buildRunView({ ...useCanvasStore.getState().results.report!, run_id: 'same' }, canonical as never)
    }
    expect(data.runView!.mainDriverOf('carry_on_as_now')).toMatchObject({ from: claim.from, to: claim.to })
    const block = mounted(data)
    expect(screen.queryByTestId('decision-matrix')).toBeNull()
    const cell = block.querySelector('[data-option-id="carry_on_as_now"][data-line-kind="cell"]')!
    const driver = block.querySelector('[data-option-id="carry_on_as_now"][data-line-kind="driver"]')!
    expect(driver).toBeTruthy()
    expect(cell.nextElementSibling).toBe(driver)
    expect(cell.textContent).not.toContain('It rests most on')
    const words = 'It rests most on how strongly ‘Pro subscribers today’ affects ‘Pro subscribers at month 12’, at the size you set: '
      + 'if that effect is weaker than that, the chance falls. How sure are you of that size?'
    expect(driver.textContent).toBe(words)
    for (const line of block.querySelectorAll('[data-option-id]')) {
      if (line.getAttribute('data-option-id') !== 'carry_on_as_now') expect(line.textContent).not.toContain(words)
    }
    console.info('L3', source, JSON.stringify({ id: driver.getAttribute('data-option-id'), cell: cell.textContent, driver: driver.textContent }))
  })
  it('L3 duplicate run-message aliases are deduped by their link/target warning identity', () => {
    const envelope = structuredClone(turn)
    const words = 'It rests most on how strongly ‘Pro subscribers today’ affects ‘Pro subscribers at month 12’, at the size you set: '
      + 'if that effect is weaker than that, the chance falls. How sure are you of that size?'
    const link = { from: 'pro_subscribers_today', to: 'pro_subscribers_at_month_12' }
    const licence = envelope.blocks[0].enrichment.inference_warnings.find(w => w.code === 'GOAL_CHANCE_LICENSED')!
    Object.assign(licence, { driver_by_option: { carry_on_as_now: { ...link, kind: 'link_strength', side: 'low',
      strength: 'weaker', authored_by: 'user', user_stated_link: true, quantity_id: `${link.from}->${link.to}` } }, no_driver_by_option: {} })
    const placeholder = envelope.blocks[0].enrichment.inference_warnings.find(w => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH')!
    const secondWording = placeholder.message
    Object.assign(placeholder, { links: [link], node_ids: [link.from, link.to], message: words })
    envelope.blocks[0].enrichment.inference_warnings.push({ ...placeholder, message: secondWording } as never)
    const block = mounted(hydrate(envelope))
    const drivers = block.querySelectorAll('[data-option-id="carry_on_as_now"][data-line-kind="driver"]')
    expect(drivers).toHaveLength(1)
    expect(drivers[0].textContent).toBe(words)
    expect(Array.from(block.querySelectorAll('p')).filter(line => line.textContent === words)).toHaveLength(1)
    expect(block.textContent).not.toContain(secondWording)
  })
  it('placeholder-only scope keeps its run message out of every option cell', () => {
    const envelope = structuredClone(turn)
    envelope.blocks[0].enrichment.inference_warnings = envelope.blocks[0].enrichment.inference_warnings
      .filter(w => w.code !== 'GOAL_FIGURES_TARGET_NOT_TESTABLE')
    const data = hydrate(envelope)
    const block = mounted(data)
    for (const option of data.recommendation.allOptions) {
      expect(block.querySelector(`[data-option-id="${option.id}"]`)!.textContent).not.toContain('This comparison turns on')
    }
    expect((screen.getByTestId('analysis-hero-panel').textContent!.match(/This comparison turns on/g) ?? [])).toHaveLength(1)
  })
  it('no option label means no lead line', () => {
    const data = hydrate()
    data.recommendation.allOptions.find(o => o.id === 'carry_on_as_now')!.label = ''
    const block = mounted(data)
    expect(block.querySelector('[data-option-id="carry_on_as_now"]')).toBeNull()
    expect(block.textContent).not.toContain('17%')
  })
  it('message identity: a second wording and reordered links do not create a second line', () => {
    const duplicate = structuredClone(turn)
    const warning = duplicate.blocks[0].enrichment.inference_warnings.find(w => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH')!
    duplicate.blocks[0].enrichment.inference_warnings.push({ ...warning, links: [...warning.links!].reverse(), message: warning.message.replace("aren't sized in the model yet", 'nobody has set yet') } as never)
    const block = mounted(hydrate(duplicate))
    expect((block.textContent!.match(/This comparison turns on/g) ?? [])).toHaveLength(1)
  })
})
