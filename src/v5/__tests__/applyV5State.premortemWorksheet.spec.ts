import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { parseV5Response, ADDITIVE_EXTENSIONS_KEY } from '../responseParser'
import { __streamInternals } from '../streamedTurnTransport'
import { useCanvasStore, selectPremortemWorksheet } from '../../canvas/store'
import { worksheetFixture, wireFixture } from './premortemFixture'
import type { OlumiResponse } from '@talchain/schemas/boundary'

const apply = (raw: unknown) => applyV5State(raw as OlumiResponse, useCanvasStore.getState() as V5ApplicatorStore)
const reset = () => useCanvasStore.setState({ currentScenarioId: worksheetFixture().scenario_id, runMeta: {}, nodes: [], edges: [] })
describe('worksheet sidecar to Canvas Run metadata', () => {
  it('keeps unrelated same-Run replies; clears on a new Run with the same graph', () => {
    reset(); apply(wireFixture())
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState())?.status, 'available')
    apply({ ...wireFixture(), _premortem_worksheet: undefined })
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState())?.status, 'available')
    apply({ ...wireFixture(), _premortem_worksheet: undefined, analysis_state: { run_state: { kind: 'complete_current', computed_at: '2026-10-07T11:00:00.000Z' } } })
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState()), null)
  })
  it('a different graph Run clears it; an unstamped replacement also clears it', () => {
    reset(); apply(wireFixture())
    apply({ ...wireFixture(), _premortem_worksheet: undefined, blocks: [{ ...wireFixture().blocks[0], computed_against_hash: 'fedcba9876543210' }] })
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState()), null)
    reset(); apply(wireFixture())
    apply({ ...wireFixture(), _premortem_worksheet: undefined, analysis_state: { run_state: { kind: 'complete_current', computed_at: '2026-10-07T11:00:00.000Z' } }, blocks: [] })
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState()), null)
  })
  it('an analysis replacement missing its timestamp cannot retain or admit an actionable worksheet', () => {
    reset(); apply(wireFixture())
    apply({ ...wireFixture(), _premortem_worksheet: undefined, analysis_state: undefined })
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState()), null)
    assert.equal(useCanvasStore.getState().runMeta.premortemRun, null)
    apply({ ...wireFixture(), analysis_state: undefined })
    assert.deepEqual(selectPremortemWorksheet(useCanvasStore.getState()), { status: 'unavailable' })
  })
  it('accumulates separately stress-tested options only within one Run', () => {
    reset(); apply(wireFixture())
    const w = worksheetFixture()
    const next = { ...w, rows: [{ ...w.rows[0], row_id: 'row-a', option_id: 'opt-a', option_label: 'Buy' }], coverage: w.coverage.map(option => ({ ...option, status: option.option_id === 'opt-a' ? 'stress_tested' : 'not_stress_tested' })) }
    apply({ ...wireFixture(), _premortem_worksheet: next })
    const held = selectPremortemWorksheet(useCanvasStore.getState())
    assert.equal(held?.status, 'available')
    if (held?.status === 'available') assert.deepEqual(held.worksheet.rows.map(row => row.option_id), ['opt-b', 'opt-a'])
  })
  it('rejects a worksheet from a different Run stamp', () => {
    reset(); apply({ ...wireFixture(), analysis_state: { run_state: { kind: 'complete_current', computed_at: '2026-10-07T11:00:00.000Z' } } })
    assert.deepEqual(selectPremortemWorksheet(useCanvasStore.getState()), { status: 'unavailable' })
  })
  it('scenario switch clears metadata and foreign worksheet is unavailable', () => {
    reset(); apply(wireFixture()); useCanvasStore.getState().adoptScenario('other')
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState()), null)
    apply(wireFixture())
    assert.deepEqual(selectPremortemWorksheet(useCanvasStore.getState()), { status: 'unavailable' })
  })
  it('a reply with no Run or sidecar retains the same worksheet', () => {
    reset(); apply(wireFixture()); apply({ response_version: 2, assistant_text: 'Hello', blocks: [], suggested_actions: [], insights: [] })
    assert.equal(selectPremortemWorksheet(useCanvasStore.getState())?.status, 'available')
  })
  for (const path of ['REST', 'COMPLETE']) it(`wire → pinned parser → applied survives ${path}`, async () => {
    reset()
    const raw = wireFixture()
    const response = path === 'REST' ? new Response(JSON.stringify(raw), { status: 200 }) : __streamInternals.terminalPayloadToResponse(raw, 200)
    const parsed = await parseV5Response(response)
    assert.equal(parsed.kind, 'response')
    if (parsed.kind !== 'response') return
    assert.equal(Object.getOwnPropertyDescriptor(parsed.response, ADDITIVE_EXTENSIONS_KEY)?.enumerable, false)
    apply(parsed.response)
    assert.deepEqual(selectPremortemWorksheet(useCanvasStore.getState()), { status: 'available', worksheet: worksheetFixture() })
  })
})
