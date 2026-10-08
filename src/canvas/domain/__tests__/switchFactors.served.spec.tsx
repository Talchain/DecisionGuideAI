import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../../nodes/FactorNode'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { buildOptionTargetRow, optionTargetReading } from '../../nodes/shared/optionTargetDisplay'
import { switchFactorIdsOf, isServedSwitch, switchReading, switchFactorNodes } from '../switchFactors'
import { factorDisplayText, factorDisplayParts } from '../../../utils/formatFactorDisplayValue'
import { factorCardReading, carriedFactorCardReading } from '../../nodes/shared/optionChangeRows'
import { formatInterventionTargetText, formatInterventionChange } from '../../utils/interventionDisplay'
import { getFactorOptionRows } from '../../utils/factorOptionSetting'
import { toModelRows, toRowDetail } from '../../model-tab-v2/adapters'
import { GraphTextView } from '../../components/GraphTextView'
import { nodeHoverFacts } from '../../components/hoverCard/NodeHoverCard'
import { resolveLodMetricLine } from '../../nodes/shared/lodMetricLine'
import { buildEstimateRows } from '../../components/pre-analysis-v3/selectors/buildEstimateRows'
import { FactorControllablePanel } from '../../ui/inspector-v2/panels/FactorControllablePanel'
import { OptionPanel } from '../../ui/inspector-v2/panels/OptionPanel'
import { ModelTabV2Panel } from '../../model-tab-v2/ModelTabV2Panel'
import { openOutlineGroups } from '../../model-tab-v2/__tests__/openOutlineGroups'
import { OptionNode, computeAllDifferentiators } from '../../nodes/OptionNode'
import { optionSetReadings } from '../../../components/results/useResultsSectionData'
import { resolveFactorPriorRangeOnCard } from '../../nodes/shared/factorPriorRange'
import persisted from '../../nodes/__tests__/fixtures/served-binary-factor-6582edbc-v3.json'
import fixture from './fixtures/served-graph-read-77d5c480.json'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, influenceImportanceBasis: null,
    influenceSetSize: null, influenceRankedCount: null, confidence: null, confidenceIsDefaulted: false,
    confidenceIsProvisional: false, inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: false, stabilityPercentage: null, winRate: null,
    isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))


const ID = 'starter_tier_availability'
const scenarioId = fixture._source.scenario_id
const mapped = () => fixture.graph.nodes.map(n => mapDraftNodeToCanvas(n as never))
const ready = fixture.current_read.analysis_ready
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  useCanvasStore.setState({ currentScenarioId: scenarioId, nodes: mapped(), edges: [],
    ceeAnalysisReady: null, servedSwitchFactorIds: new Set<string>(), lastAuthoritativeGraph: null, serverGraphIdentity: null,
    viewMode: 'standard', lodRung: 'full', goalConstraints: [],
    results: { status: 'idle', report: null }, analysisFreshnessDirty: false,
  } as never)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function card(id = ID) {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)!
  render(<ReactFlowProvider><FactorNode id={id} type="factor" data={node.data as never}
    selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
  const el = screen.queryByTestId('factor-recorded-value') ?? screen.getByTestId(`factor-value-mark-only-${id}`)
  const copy = el.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.sr-only').forEach(n => n.remove())
  const band = screen.getByTestId(`factor-bottom-marks-${id}`)
  const tier = band.querySelector('[data-card-mark="factor-tier"]')?.getAttribute('aria-label')
  const source = band.querySelector('[data-card-mark="source-olumi"]')
  expect(source).not.toBeNull()
  const sourceWords = source!.querySelector('[aria-label="est."]')?.getAttribute('aria-label')
  expect(sourceWords).toBe('est.')
  return `${tier ?? copy.textContent?.replace(/\s+/g, ' ').trim()} ${sourceWords}`.trim()
}
describe('served switch reading, bound to starter_tier_availability', () => {
  it('#7 live factor card', () => {
    useCanvasStore.getState().setCeeAnalysisReady(ready as never)
    expect(card()).toBe('Not in use est.')
  })
  it('#2 user-set option inspector never prints on', () => {
    useCanvasStore.getState().setCeeAnalysisReady(ready as never)
    const factorNode = useCanvasStore.getState().nodes.find(n => n.id === ID)!
    const row = buildOptionTargetRow({ factorId: ID, factorNode, target: { value: 1, displayValue: 'on', source: 'user_specified' }, baselineReference: null })
    expect(optionTargetReading(row, factorNode.data)).toBe('In use')
  })
  it('RELOAD: real graph read alone, no turn or storage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      schema: 'scenario_graph.v1', graph_present: true, scenario_id: scenarioId,
      graph: fixture.graph, current_read: fixture.current_read, layout_present: false,
    }) }))
    expect(await hydrateCanvasFromServer(scenarioId)).toBe('merged')
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(card()).toBe('Not in use est.')
  })
})

function projection() {
  const state = useCanvasStore.getState()
  const nodes = switchFactorNodes(state.nodes, state)
  const factor = nodes.find(n => n.id === ID)!
  const option = nodes.find(n => n.id === 'launch_starter_tier')!
  return { nodes, factor, option, input: { nodes, edges: [], goalThreshold: null } }
}
function optionRow() {
  const { factor } = projection()
  return buildOptionTargetRow({ factorId: ID, factorNode: factor,
    target: { value: 1, source: 'user_specified' }, baselineReference: null })
}
function textProbe(row: number, text: string | null) {
  const r = render(<output data-testid={`reader-${row}-${ID}`}>{text}</output>)
  const el = screen.getByTestId(`reader-${row}-${ID}`)
  const copy = el.textContent
  r.unmount()
  return copy
}
// Each value-reading class binds the same factor id to its owner's exact text.
const readingRows: Array<[number, string, () => string | null]> = [
  [1, 'Not in use → In use', () => optionRow().change],
  [2, 'In use', () => optionTargetReading(optionRow(), projection().factor.data)],
  [3, 'In use', () => optionTargetReading(optionRow(), projection().factor.data)],
  [4, 'In use', () => optionSetReadings(projection().option.data, projection().nodes).find(r => r === 'In use') ?? null],
  [6, 'In use', () => formatInterventionTargetText({ label: 'Starter tier availability', value: 1, factorData: projection().factor.data })],
  [8, 'Not in use', () => factorDisplayText(projection().factor.data)],
  [9, 'Not in use', () => carriedFactorCardReading(projection().factor.data)],
  [10, 'In use', () => formatInterventionTargetText({ label: 'Starter tier availability', value: 1, displayValue: 'on', factorData: projection().factor.data })],
  [13, 'Not in use', () => factorDisplayText(projection().factor.data)],
  [14, 'In use', () => getFactorOptionRows(ID, projection().nodes, null, projection().factor.data.observedState as never).find(r => r.id === 'launch_starter_tier')!.displayValue],
  [16, 'Not in use', () => toModelRows(projection().input).find(r => r.id === ID)!.primaryValue],
  [17, 'In use', () => (toRowDetail(projection().input, 'launch_starter_tier') as any).interventions.find((r: any) => r.factorId === ID).value],
  [19, 'Not in use', () => nodeHoverFacts(ID, 'factor', projection().factor.data, projection().nodes, []).value!.text],
  [20, 'Not in use', () => resolveLodMetricLine({ nodeType: 'factor', data: projection().factor.data, label: 'Starter tier availability', displayMetadata: {} as never })],
  [22, 'Not in use', () => buildEstimateRows(projection().nodes, { source: 'degree', weights: { [ID]: 1 }, ordered: [ID] }, null)[0].displayText],
]
async function coldHydrate(over: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
    schema: 'scenario_graph.v1', graph_present: true, scenario_id: scenarioId,
    graph: fixture.graph, current_read: fixture.current_read, layout_present: false, ...over,
  }) }))
  return hydrateCanvasFromServer(scenarioId)
}
for (const mode of ['live', 'cold'] as const) {
  describe(`${mode}: reader classes and sweep`, () => {
    beforeEach(async () => {
      if (mode === 'live') useCanvasStore.getState().setCeeAnalysisReady(ready as never)
      else { expect(await coldHydrate()).toBe('merged'); expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull() }
    })
    it.each(readingRows)('#%i exact owner reading: %s', (row, expected, read) => {
      expect(textProbe(row, read())).toBe(expected)
    })
    it('#7 mounted card and #8 formatter agree, with provenance', () => {
      expect(card()).toBe('Not in use est.')
      expect(factorCardReading(projection().factor.data)).toBe('Not in use')
      expect(factorDisplayParts(projection().factor.data)).toBeNull()
    })
    it('#20 mounted far-zoom line uses the same served state', () => {
      useCanvasStore.setState({ lodRung: 'line' })
      const node = useCanvasStore.getState().nodes.find(n => n.id === ID)!
      const r = render(<ReactFlowProvider><div data-id={ID}><FactorNode id={ID} type="factor" data={node.data as never}
        selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable /></div></ReactFlowProvider>)
      expect(r.container.querySelector('[data-testid="node-lod-line-text"]')?.textContent).toBe('Not in use')
      expect(r.container.querySelector('[data-testid="node-lod-line-text"]')?.closest('[data-id]')?.getAttribute('data-id')).toBe(ID)
    })
    it('#18 mounted text view', () => {
      render(<GraphTextView nodes={useCanvasStore.getState().nodes} edges={[]} onNodeClick={vi.fn()} />)
      const node = screen.getByTestId(`graph-text-view-node-${ID}`).parentElement!
      expect(node.textContent).toContain('Not in use')
      expect(node.textContent).not.toMatch(/Very low|Very high|\bon\b|\boff\b/i)
    })
    it('#13/#14 mounted factor inspector: value and set by options', () => {
      render(<FactorControllablePanel nodeId={ID} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} readOnly />)
      // The standalone value duplicate moved to the summary sentence.
      expect(screen.getByTestId('inspector-summary-sentence').textContent).toBe('Starter tier availability is Not in use.')
      expect(screen.getByText('In use')).toBeTruthy()
    })
    it('#2 mounted option inspector, including a user-set target', () => {
      render(<OptionPanel nodeId="launch_starter_tier" techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} readOnly />)
      const row = screen.getByTestId(`intervention-readout-${ID}`)
      expect(row.textContent?.replace(/\s+/g, ' ').trim()).toBe('This option sets In use')
    })
    it('#16/#17 mounted Model tab', () => {
      render(<ModelTabV2Panel {...projection().input} />)
      openOutlineGroups()
      expect(screen.getByTestId(`model-row-v2-${ID}-value`).textContent).toBe('Not in use')
    })
    it.each(['standard', 'expert'] as const)('#1/#5/#6 mounted option card in %s view', mode => {
      useCanvasStore.setState({ viewMode: mode })
      const option = useCanvasStore.getState().nodes.find(n => n.id === 'launch_starter_tier')!
      const r = render(<ReactFlowProvider><OptionNode id={option.id} type="option" data={option.data as never}
        selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
      const valueRow = r.container.querySelector(`[data-testid="option-change-row-value-launch_starter_tier-${ID}"]`)
      expect(valueRow?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Not in use → In use')
      expect(valueRow?.textContent).not.toMatch(/Very low|Very high|\bon\b|\boff\b/i)
    })
    it('sweep: every rendered owner reading has no tier or bare on/off', () => {
      for (const [row, , read] of readingRows) {
        expect(textProbe(row, read())).not.toMatch(/Very low|Very high|\bon\b|\boff\b/i)
      }
      const change = formatInterventionChange({ label: 'Starter tier availability', baselineValue: 0, targetValue: 1, factorData: projection().factor.data })
      expect(change.baselineText).toBe('Not in use')
      expect(change.targetText).toBe('In use')
    })
  })
}
it('CONTROL: price_rise stays 10%; starter_monthly_price keeps £49/subscriber/month', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  const { nodes } = projection()
  for (const [id, value, displayValue] of [['price_rise', 0.1, '10%'], ['starter_monthly_price', 0.245, '£49/subscriber/month']] as const) {
    const node = nodes.find(n => n.id === id)!
    expect(isServedSwitch(id, useCanvasStore.getState())).toBe(false)
    expect(formatInterventionTargetText({ label: String(node.data.label), value, displayValue, factorData: node.data })).toBe(displayValue)
  }
})
it('CONTROL: a true 0–1 proportion at 0.1 has no served switch and stays Very low', () => {
  const analysis = { options: [{ intervention_details: { proportion: { display_value: 'Very low (0.1)' } } }] }
  expect(isServedSwitch('proportion', { ceeAnalysisReady: analysis })).toBe(false)
  const data = { label: 'Proportion', display_value: '0.1 scale', observedState: { value: 0.1, unit: 'scale', source: 'cee_inference', extractionType: 'inferred' } }
  const nodes = switchFactorNodes([{ id: 'proportion', type: 'factor', data }], { ceeAnalysisReady: analysis })
  useCanvasStore.setState({ nodes, ceeAnalysisReady: analysis } as never)
  expect(card('proportion')).toBe('Very low est.')
  expect(screen.getByTestId('factor-value-tier-proportion')).toHaveAttribute('aria-label', 'Very low')
  expect(screen.getByTestId('estimate-marker').closest('[data-card-bottom-band]')).not.toBeNull()
})
it('PRECONDITION: persisted production graph without analysis_ready mints no switch', () => {
  expect([...switchFactorIdsOf(persisted)]).toEqual([])
  const nodes = switchFactorNodes(persisted.nodes.map(n => mapDraftNodeToCanvas(n as never)), {})
  const factor = nodes.find(n => n.id === 'fac_freelance_resource_brought_in')!
  expect(factorCardReading(factor.data)).toBe('0')
  useCanvasStore.setState({ nodes, ceeAnalysisReady: null, servedSwitchFactorIds: new Set<string>() } as never)
  expect(card(factor.id)).toBe('Very low est.')
  expect(screen.getByTestId(`factor-value-tier-${factor.id}`)).toHaveAttribute('aria-label', 'Very low')
  expect(screen.getByTestId('estimate-marker').closest('[data-card-bottom-band]')).not.toBeNull()
  const row = buildOptionTargetRow({ factorId: factor.id, factorNode: factor, target: { value: 1, source: 'user_specified' }, baselineReference: null })
  expect(row.change).toBe('0 → Very high')
  expect(optionTargetReading(row, factor.data)).toBe('Very high (1)')
  const option = nodes.find(n => n.id === 'c3d38027')!
  expect(option.data.interventions).toBeDefined()
  expect(isServedSwitch(factor.id, {})).toBe(false)
})
it('scenario fence: DECISION_CONTEXT_CLEAR evicts the set', async () => {
  await coldHydrate()
  expect(useCanvasStore.getState().servedSwitchFactorIds.has(ID)).toBe(true)
  useCanvasStore.getState().hydrateGraphSlice({ nodes: [], edges: [], currentScenarioId: 'other-scenario' })
  expect(useCanvasStore.getState().servedSwitchFactorIds.size).toBe(0)
})
it('scenario fence: a foreign response never populates the set', async () => {
  await coldHydrate({ scenario_id: 'other-scenario' })
  expect(useCanvasStore.getState().servedSwitchFactorIds.size).toBe(0)
})
it('a late read after switching scenarios never populates the set', async () => {
  let release!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { release = resolve })))
  const pending = hydrateCanvasFromServer(scenarioId)
  useCanvasStore.getState().hydrateGraphSlice({ nodes: [], edges: [], currentScenarioId: 'other-scenario' })
  release({ ok: true, status: 200, json: async () => ({ schema: 'scenario_graph.v1', graph_present: true, scenario_id: scenarioId, graph: fixture.graph, current_read: fixture.current_read }) })
  expect(await pending).toBe('skipped')
  expect(useCanvasStore.getState().servedSwitchFactorIds.size).toBe(0)
})
// ── Buddy r1 (Codex, #2608 @34c8d7a5) findings, one row each ─────────────────────────────────────────────
it('BUDDY P1: a served id whose OWN value is off 0/1 is not a switch on its card or its option rows', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  const nodes = useCanvasStore.getState().nodes.map(n => n.id !== ID ? n
    : { ...n, data: { ...n.data, observedState: { ...(n.data as any).observedState, value: 0.1 } } })
  useCanvasStore.setState({ nodes } as never)
  const { factor } = projection()
  expect(isServedSwitch(ID, useCanvasStore.getState())).toBe(true)
  const text = formatInterventionTargetText({ label: String(factor.data.label), value: 1, factorData: factor.data })
  expect(text).not.toBe('In use')
  // Buddy r2: the option row's producer-word fallback is guarded too (baseline option 0 → this option 1, CEE "on").
  const row = buildOptionTargetRow({ factorId: ID, factorNode: factor, target: { value: 1, source: 'user_specified', displayValue: 'on' } as never,
    baselineReference: { label: 'Keep pricing as it is', values: { [ID]: { value: 0, displayValue: 'off', source: null } } } as never })
  expect(row.change).not.toBe('Not in use → In use')
  // The card reads through the shared formatter (#8); with its own value at 0.1 it must not word a switch.
  expect(String(factorDisplayText(factor.data as never) ?? '')).not.toMatch(/Not in use|In use/)
})
it('BUDDY P1: a local scenario switch (loadScenario) clears the served set', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  expect(useCanvasStore.getState().servedSwitchFactorIds.has(ID)).toBe(true)
  const other = { id: 'scenario-b', name: 'B', createdAt: 1, updatedAt: 1,
    graph: { nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Same id, not a switch', observedState: { value: 0 } } }], edges: [] } }
  localStorage.setItem('olumi-canvas-scenarios', JSON.stringify([other]))
  expect(useCanvasStore.getState().loadScenario('scenario-b')).toBe(true)
  expect(useCanvasStore.getState().currentScenarioId).toBe('scenario-b')
  expect(useCanvasStore.getState().servedSwitchFactorIds.size).toBe(0)
  expect(isServedSwitch(ID, useCanvasStore.getState())).toBe(false)
})
it('BUDDY P2: an UNSET option target on a served switch reads as unset in the Model tab, never "Not in use"', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  const nodes = useCanvasStore.getState().nodes.map(n => n.id !== 'launch_starter_tier' ? n
    : { ...n, data: { ...n.data, interventions: { ...((n.data as any).interventions ?? {}), [ID]: null } } })
  useCanvasStore.setState({ nodes } as never)
  const detail = toRowDetail(projection().input, 'launch_starter_tier') as any
  const row = detail?.interventions?.find((r: any) => r.factorId === ID)
  // Buddy r2 P2: bind the row's existence and its exact unset state, never a "not X" that a missing row satisfies.
  expect(row).toBeDefined()
  expect(row.value).toBeNull()
  expect(row.numericValue).toBeNull()
})

it('encoding_map supplies the factor’s own state words', () => {
  expect(switchReading({ encoding_map: { 0: 'Not adopted', 1: 'Adopted' } }, 0)).toBe('Not adopted')
  expect(switchReading({ encoding_map: { 0: 'Not adopted', 1: 'Adopted' } }, 1)).toBe('Adopted')
})
it('parser rejects malformed inputs and bare digits, trims producer words', () => {
  for (const input of [null, [], {}, { options: {} }, { options: [null, { intervention_details: [] }] }]) expect([...switchFactorIdsOf(input)]).toEqual([])
  expect([...switchFactorIdsOf({ options: [{ intervention_details: { yes: { display_value: ' on ' }, number: { display_value: '1' }, phrase: { display_value: 'Turn on' } } }] })]).toEqual(['yes'])
})

// Non-value classes are explicit rows, rather than being silently dropped from the class map.
export const nonValueClasses = [
  [11, 'band table: served readings return before the magnitude fallback'],
  [12, 'unit leak guard: classifies/suppresses unit strings, never reads a state value'],
  [15, 'type pill: states factor type, not value; this fixture has no binary factor_type'],
  [21, 'prior range: fixture has no prior; a controllable value is not the external prior range'],
  [23, 'legacy pre-analysis: pre-analysis v3 is the mounted path'],
  [24, 'legacy option preview: same legacy path; v3 is the mounted path'],
  [25, 'Drivers: label suffix regex, no switch-state reading'],
  [26, 'label cleaner: label text only, no value formatting'],
  [27, 'thresholds: ISL split-unit thresholds, not observed factor states'],
  [28, 'diff/versions: literal stored field deltas; transient on/off is absent from the graph'],
  [29, 'chat blocks: forward producer prose, no factor value formatter'],
  [30, 'legend: provenance vocabulary only'],
  [31, 'retired popover: no-op'],
  [32, 'node schema: data carrier, no rendering'],
  [33, 'wire-to-canvas: data carrier; switch authority remains in analysis_ready'],
  [34, 'turn intake: shared setter ingests producer signal'],
  [35, 'reload restore: graph-read-only set; ceeAnalysisReady stays null'],
  [36, 'unused normaliser: no runtime import'],
] as const
it('#11 magnitude table remains a fallback after served-state reading', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  expect(factorDisplayText(projection().factor.data)).toBe('Not in use')
})
it('#12 a served switch reading carries no pseudo-unit split', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  expect(factorDisplayParts(projection().factor.data)).toBeNull()
})
it('#15 type pill is not a state value; the served switch declares no binary type', () => {
  expect(projection().factor.data).not.toHaveProperty('factorType', 'binary')
  expect(projection().factor.data).not.toHaveProperty('factor_type', 'binary')
})
it('#21 prior range is hidden: this served controllable factor carries no prior', () => {
  const data = projection().factor.data
  expect(data).not.toHaveProperty('prior')
  expect(resolveFactorPriorRangeOnCard({ data, nodeCategory: 'controllable', observedState: data.observedState as never, valueDisplay: factorDisplayText(data) })).toBeNull()
})
it('#33 wire-to-canvas retains the producer value; the display projection never persists a marker', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  const state = useCanvasStore.getState()
  const before = JSON.stringify(state.nodes)
  const display = projection()
  expect(display.factor.data).not.toBe(state.nodes.find(n => n.id === ID)!.data)
  expect(JSON.stringify(display.nodes)).toBe(before)
  expect(JSON.stringify(state.nodes)).toBe(before)
})
it('#34 turn intake reads the producer signal through the shared setter', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  expect([...useCanvasStore.getState().servedSwitchFactorIds]).toEqual([ID])
  expect(useCanvasStore.getState().ceeAnalysisReady).toEqual(ready)
})
it('#35 accepted graph read restores only switch IDs, not readiness', async () => {
  await coldHydrate()
  expect([...useCanvasStore.getState().servedSwitchFactorIds]).toEqual([ID])
  expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
  expect(sessionStorage.getItem('olumi-cee-analysis-ready')).toBeNull()
})
it('#5 differentiator names the unique switch; no redundant state is worded', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  const { nodes } = projection()
  const sentences = computeAllDifferentiators(nodes, null)
  expect(sentences.get('launch_starter_tier')?.fullLabel).toBe('Starter tier availability is the key difference')
  expect(sentences.get('launch_starter_tier')?.fullLabel).not.toMatch(/Very low|Very high|\bon\b|\boff\b/i)
})

it('a partial encoding map keeps the factor’s own phrase on its mapped end', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  const { factor } = projection()
  const data = { ...factor.data, encoding_map: { 0: 'Not adopted' } }
  const row = buildOptionTargetRow({ factorId: ID, factorNode: { ...factor, data }, target: { value: 1 }, baselineReference: null })
  expect(factorDisplayText(data)).toBe('Not adopted')
  expect(row.change).toBe('Not adopted → In use')
})
it('cached identity still restores switch IDs on the unchanged graph-read branch', async () => {
  const identity = { value: 'a'.repeat(64), projectionVersion: 'identity.v1', graphSchemaVersion: 'graph_v3', normaliserVersion: '1' }
  useCanvasStore.setState({ serverGraphIdentity: identity } as never)
  expect(await coldHydrate({ graph_identity_hash: { kind: 'graph_identity_hash', value: identity.value, algorithm: 'sha256', projection_version: 'identity.v1', graph_schema_version: 'graph_v3', normaliser_version: '1' } })).toBe('unchanged')
  expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
  expect(card()).toBe('Not in use est.')
})

it('a scenario without a served signal cannot inherit a previous display projection', () => {
  const live = switchFactorNodes(mapped(), { ceeAnalysisReady: ready })
  expect(factorDisplayText(live.find(n => n.id === ID)!.data)).toBe('Not in use')
  const cleared = switchFactorNodes(live, { ceeAnalysisReady: null, servedSwitchFactorIds: new Set<string>() })
  expect(factorDisplayText(cleared.find(n => n.id === ID)!.data)).not.toBe('Not in use')
  expect(JSON.stringify(cleared)).toBe(JSON.stringify(mapped()))
})

it('a pending human switch edit reads its requested state without changing the recorded graph', () => {
  useCanvasStore.getState().setCeeAnalysisReady(ready as never)
  const { factor } = projection()
  const recorded = JSON.stringify(useCanvasStore.getState().nodes)
  expect(factorDisplayText({ ...factor.data, pending_user_value: 1 })).toBe('In use')
  expect(factorDisplayText(factor.data)).toBe('Not in use')
  expect(JSON.stringify(useCanvasStore.getState().nodes)).toBe(recorded)
})
