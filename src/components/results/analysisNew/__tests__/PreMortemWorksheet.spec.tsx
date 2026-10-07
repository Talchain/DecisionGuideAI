import { describe, it, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PreMortemWorksheet } from '../sections/PreMortemWorksheet'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { worksheetFixture } from '../../../../v5/__tests__/premortemFixture'
import { readPremortemWorksheet } from '../../../../v5/readPremortemWorksheet'
import { buildChipMeta } from '../../../../canvas/conversation/chipMeta'
import { buildV5Payload } from '../../../../v5/buildPayload'

const seed = () => {
  const worksheet = worksheetFixture()
  useCanvasStore.setState({ currentScenarioId: worksheet.scenario_id, analysisFreshnessDirty: false,
    lastServerGraphHash: worksheet.run.graph_hash_at_run,
    nodes: ['opt-a', 'opt-b', 'factor', 'goal'].map(id => ({ id, type: id.startsWith('opt') ? 'option' : id === 'goal' ? 'goal' : 'factor', position: { x: 0, y: 0 }, data: { label: { 'opt-a': 'Buy', 'opt-b': 'Build', factor: 'Capacity', goal: 'Growth' }[id] } })), edges: [],
    runMeta: { premortemWorksheet: readPremortemWorksheet({ _premortem_worksheet: worksheet }), premortemRun: { scenarioId: worksheet.scenario_id, graphHashAtRun: worksheet.run.graph_hash_at_run, computedAt: worksheet.run.computed_at } },
  })
  return worksheet
}
const open = (view: ReturnType<typeof render>) => fireEvent.click(view.getByTestId('premortem-worksheet-toggle'))
afterEach(cleanup)
describe('pre-mortem section', () => {
  it('renders options in model order, warnings, grounding and uncovered options', () => {
    const worksheet = seed(); const view = render(<PreMortemWorksheet />); open(view)
    assert.deepEqual([...view.container.querySelectorAll('[data-option-id]')].map(el => el.getAttribute('data-option-id')), ['opt-a', 'opt-b'])
    assert.ok(view.getByText('Not stress-tested')); assert.ok(view.getByText('Early warning: Delivery slows.'))
    assert.ok(view.getByRole('button', { name: 'Capacity' })); assert.ok(view.getByText('Olumi hypothesis: for you to challenge'))
    assert.equal(view.container.querySelector('time')?.getAttribute('dateTime'), worksheet.run.computed_at)
    assert.ok(view.getByText('What have we missed?'))
  })
  it('places failure rows in model order even when the carrier rows are reversed', () => {
    const w = seed()
    const raw = { ...w, rows: [w.rows[0], { ...w.rows[0], row_id: 'row-a', option_id: 'opt-a', option_label: 'Buy' }], coverage: w.coverage.map(option => ({ ...option, status: 'stress_tested' })) }
    useCanvasStore.setState({ runMeta: { ...useCanvasStore.getState().runMeta, premortemWorksheet: readPremortemWorksheet({ _premortem_worksheet: raw }) } })
    const view = render(<PreMortemWorksheet />); open(view)
    assert.deepEqual([...view.container.querySelectorAll('[data-row-id]')].map(row => row.getAttribute('data-row-id')), ['row-a', 'row-b'])
  })
  it('a grounding label opens the existing inspector on that element', () => {
    seed(); const view = render(<PreMortemWorksheet />); open(view)
    let opened = 0
    const onOpen = () => { opened += 1 }
    window.addEventListener('olumi:open-full-inspector', onOpen)
    try {
      fireEvent.click(view.getByRole('button', { name: 'Capacity' }))
      assert.deepEqual([...useCanvasStore.getState().selection.nodeIds], ['factor'])
      assert.equal(opened, 1)
    } finally { window.removeEventListener('olumi:open-full-inspector', onOpen) }
  })
  it('link grounding opens its inspector and sends endpoint identity on the wire', () => {
    const w = seed()
    const raw = { ...w, rows: [{ ...w.rows[0], grounding: { kind: 'link', ids: ['factor->goal'], labels: ['Capacity', 'Growth'] }, risk_request: { ...w.rows[0].risk_request, grounding_ids: ['factor->goal'] } }] }
    useCanvasStore.setState({ edges: [{ id: 'ui-edge', source: 'factor', target: 'goal' }], runMeta: { ...useCanvasStore.getState().runMeta, premortemWorksheet: readPremortemWorksheet({ _premortem_worksheet: raw }) } })
    let wire: unknown
    useGuidanceStore.setState({ _dispatchAction: opts => {
      const build = buildV5Payload({ turnId: '11111111-1111-4111-8111-111111111111', scenarioId: w.scenario_id, stage: 'analyse', turnClass: 'clarify', mode: 'user', message: opts.message, source: opts.source, chipMeta: buildChipMeta(opts) })
      if (build.ok && build.payload.kind === 'message') wire = build.payload.selected_elements
    } })
    const view = render(<PreMortemWorksheet />); open(view)
    fireEvent.click(view.getByRole('button', { name: 'Capacity → Growth' }))
    assert.deepEqual([...useCanvasStore.getState().selection.edgeIds], ['ui-edge'])
    fireEvent.click(view.getByRole('button', { name: 'Add this as a risk' }))
    assert.deepEqual(wire, [{ id: 'goal', kind: 'goal', label: 'Growth' }, { id: 'factor→goal', kind: 'edge' }])
  })
  it('outside grounding has the exact label', () => {
    const w = seed(); const raw = { ...w, rows: [{ ...w.rows[0], grounding: { kind: 'not_in_model', label: 'not in the model yet' }, risk_request: { ...w.rows[0].risk_request, grounding_ids: [] } }] }
    useCanvasStore.setState({ runMeta: { ...useCanvasStore.getState().runMeta, premortemWorksheet: readPremortemWorksheet({ _premortem_worksheet: raw }) } })
    const view = render(<PreMortemWorksheet />); open(view); assert.ok(view.getByText('not in the model yet'))
  })
  for (const cause of ['hash', 'dirty', 'time', 'busy', 'removed', 'missing_stamp']) it(`disables risk actions for ${cause}`, () => {
    seed(); useGuidanceStore.setState({ _dispatchAction: () => assert.fail('disabled action dispatched') })
    if (cause === 'hash') useCanvasStore.setState({ lastServerGraphHash: 'fedcba9876543210' })
    if (cause === 'dirty') useCanvasStore.setState({ analysisFreshnessDirty: true })
    if (cause === 'removed') useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.filter(node => node.id !== 'factor') })
    if (cause === 'missing_stamp') useCanvasStore.setState({ runMeta: { ...useCanvasStore.getState().runMeta, premortemRun: null } })
    if (cause === 'time') useCanvasStore.setState({ runMeta: { ...useCanvasStore.getState().runMeta, premortemRun: { ...useCanvasStore.getState().runMeta.premortemRun!, computedAt: '2026-10-07T11:00:00.000Z' } } })
    const view = render(<PreMortemWorksheet isBusy={cause === 'busy'} />); open(view)
    const button = view.getByRole('button', { name: 'Add this as a risk' }) as HTMLButtonElement
    assert.equal(button.disabled, true); fireEvent.click(button)
  })
  it('empty state dispatches the existing generic press once', () => {
    seed(); useCanvasStore.setState({ runMeta: {} }); const calls: unknown[][] = []
    useGuidanceStore.setState({ _sendChip: (...args) => { calls.push(args) } })
    const view = render(<PreMortemWorksheet />); open(view); fireEvent.click(view.getByRole('button', { name: 'Generate worksheet' }))
    assert.equal(calls.length, 1); assert.deepEqual(calls[0][2], { id: 'agent-next-pre-mortem' })
  })
  it('one risk click dispatches the authored request and row selection once without graph mutation', () => {
    const w = seed(); const state = useCanvasStore.getState(); const graph = JSON.stringify([state.nodes, state.edges]); const calls: unknown[] = []
    let wire: unknown
    useGuidanceStore.setState({ _dispatchAction: opts => {
      calls.push(opts); const build = buildV5Payload({ turnId: '11111111-1111-4111-8111-111111111111', scenarioId: w.scenario_id, stage: 'analyse', turnClass: 'clarify', mode: 'user', message: opts.message, source: opts.source, chipMeta: buildChipMeta(opts) })
      assert.equal(build.ok, true); if (build.ok && build.payload.kind === 'message') wire = build.payload.selected_elements
    } })
    const view = render(<PreMortemWorksheet />); open(view); fireEvent.click(view.getByRole('button', { name: 'Add this as a risk' }))
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], { id: 'agent-next-suggest-risks', label: 'Add this as a risk', message: w.rows[0].risk_request.message, source: 'chip', selected_elements: [{ id: 'goal', kind: 'goal', label: 'Growth' }, { id: 'factor', kind: 'factor', label: 'Capacity' }] })
    assert.deepEqual(wire, [{ id: 'factor', kind: 'factor', label: 'Capacity' }, { id: 'goal', kind: 'goal', label: 'Growth' }])
    assert.equal(JSON.stringify([useCanvasStore.getState().nodes, useCanvasStore.getState().edges]), graph)
  })
  it('every section button declares a touch target of at least 24px', () => {
    seed(); const view = render(<PreMortemWorksheet />); open(view)
    for (const button of view.container.querySelectorAll('button')) assert.match(button.className, /min-h-\[(?:24|28|32)px\]/)
  })
})
