import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { AnyNodeDataSchema, AnyNodeDataImportSchema, FactorNodeDataSchema, NodeTypeEnum } from '../../../domain/nodes'
import { importSnapshot } from '../../../domain/migrations'
import { classifyNodeProvenance } from '../../../domain/valueProvenance'
import { NodeProvenanceMark } from '../../../nodes/shared/NodeProvenanceMark'
import { factorValueSourceMark, ValueSourceMark } from '../../../nodes/shared/valueSourceMark'
import { CanvasLegendPopover } from '../../CanvasLegendPopover'
import { provenanceKey } from '../../provenanceKey'
import { factorValueSourceLabel } from '../../../ui/inspector-v2/inspectorStrings'
import { provenanceToPill } from '../provenanceUtils'
import { buildEstimateRows } from '../../pre-analysis-v3/selectors/buildEstimateRows'
import { computeGraphFacts, computeProvenanceCounts } from '../../pre-analysis-v3/selectors/graphFacts'
import { projectAuthoredEntities } from '../../pre-analysis-v3/selectors/projectAuthoredEntities'
import { EstimateRow } from '../../pre-analysis-v3/model/EstimateRow'
import { YourDecisionSection } from '../../pre-analysis-v3/model/YourDecisionSection'
import type { PreAnalysisModel } from '../../pre-analysis-v3/hooks/usePreAnalysisModel'

vi.mock('../../../../lib/supabase', async () => {
  const { createClient } = await import('../../../../stubs/supabase-stub.mjs')
  return { supabase: createClient(), isSupabaseAvailable: () => false }
})

const LABEL = 'Not confirmed from your brief'

function factor(provenance: string, source?: string): Node {
  const input = {
    type: 'factor', label: 'Monthly price', provenance,
    observedState: { raw_value: 49, value: 0.49, unit: 'GBP', ...(source ? { source } : {}) },
  }
  // Both the domain parser and the snapshot import boundary must preserve the node.
  const data = AnyNodeDataImportSchema.parse(FactorNodeDataSchema.parse(input))
  return { id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data }
}

function estimate(node: Node) {
  return buildEstimateRows([node], {
    ordered: [node.id], weights: { [node.id]: 1 }, source: 'degree',
  }, null)[0]
}

function expectNoOlumi(container: HTMLElement) {
  expect(container).not.toHaveTextContent(/\[Olumi\]|Olumi(?:’s|'s)? estimate|AI estimate|Olumi suggested this/i)
  expect(container.querySelector('[data-card-mark="source-olumi"]')).toBeNull()
}

describe('unverified brief provenance is disclosed without inventing authorship', () => {
  it('accepts unknown provenance through both discriminated unions for every supported node type', () => {
    for (const type of NodeTypeEnum.options) {
      const data = { type, label: `Future ${type}`, provenance: 'future_provenance' }
      expect(AnyNodeDataSchema.parse(data)).toMatchObject(data)
      expect(AnyNodeDataImportSchema.parse(data)).toMatchObject(data)
    }
  })

  it('keeps unknown-provenance nodes through snapshot import when only the node kind is recorded', () => {
    const nodes = NodeTypeEnum.options.map(type => ({
      id: type, type, position: { x: 0, y: 0 },
      data: { kind: type, label: `Future ${type}`, provenance: 'future_provenance', source_quote: 'Recorded material' },
    }))
    const snapshot = importSnapshot({ version: 2, timestamp: 1, nodes, edges: [] })
    expect(snapshot).not.toBeNull()
    expect(snapshot!.nodes).toHaveLength(nodes.length)
    for (const node of snapshot!.nodes) {
      expect(node.data).toMatchObject({ ...nodes.find(n => n.id === node.id)!.data, type: node.type })
    }
  })

  it.each([undefined, 'cee_inference', 'brief_extraction', 'user_confirmed', 'user_assumption']) (
    'parses and renders the exact neutral copy even beside observed source %s', source => {
      const node = factor('unverified_brief', source)
      expect(node.data.provenance).toBe('unverified_brief')
      expect(classifyNodeProvenance(node.data.provenance as string)).toEqual({ kind: 'unverified_brief', userOwned: false })
      const pill = provenanceToPill('unverified_brief', source, true)
      expect(pill?.label).toBe(LABEL)
      const row = estimate(node)
      expect(row.aiSourced).toBe(false)
      expect(row.reviewed).toBe(false)
      expect(row.attribution).toBeNull()
      expect(row.provenanceKind).toBe('unverified_brief')
      const mark = factorValueSourceMark(node.data)!
      const { container } = render(createElement('div', null,
        createElement(NodeProvenanceMark, { nodeType: 'factor', data: node.data }),
        createElement(ValueSourceMark, { mark }),
        createElement(EstimateRow, { row, expanded: false, onToggle: vi.fn() }),
      ))
      expect(screen.getByTestId('pre-analysis-v3-estimate-factor-1')).toHaveTextContent(LABEL)
      expect(screen.getByTestId('node-provenance-mark')).toHaveAccessibleName(LABEL)
      expect(mark.label).toBe(LABEL)
      expect(factorValueSourceLabel(node.data)).toBe(LABEL)
      expectNoOlumi(container)
      expect(computeProvenanceCounts([node]).aiEstimatedCount).toBe(0)
      expect(computeProvenanceCounts([node]).reviewedCount).toBe(0)
    },
  )

  it('retains a future member through parsing with no authorship pill or Olumi fallback', () => {
    const node = factor('future_provenance', 'cee_inference')
    expect(node.data.provenance).toBe('future_provenance')
    expect(classifyNodeProvenance('future_provenance')).toBeNull()
    expect(provenanceToPill('future_provenance', 'cee_inference', true)).toBeNull()
    const row = estimate(node)
    expect(row.attribution).toBeNull()
    expect(factorValueSourceLabel(node.data)).toBe('Source not recorded')
    const { container } = render(createElement('div', null,
      createElement(NodeProvenanceMark, { nodeType: 'factor', data: node.data }),
      createElement(EstimateRow, { row, expanded: false, onToggle: vi.fn() }),
    ))
    expect(screen.queryByTestId('node-provenance-mark')).toBeNull()
    expectNoOlumi(container)
  })

  it('discloses unverified options and risks in their rendered entity rows', () => {
    const nodes: Node[] = ['option', 'risk'].map(type => ({
      id: type, type, position: { x: 0, y: 0 },
      data: AnyNodeDataImportSchema.parse({ type, label: `User material ${type}`, provenance: 'unverified_brief' }),
    }))
    const options = projectAuthoredEntities(nodes, 'option')
    const risks = projectAuthoredEntities(nodes, 'risk')
    expect(options[0].attribution).toEqual({ kind: 'unattributed' })
    expect(risks[0].attribution).toEqual({ kind: 'unattributed' })
    const model = {
      options, risks, hero: { hasDecision: false, goal: null, success: { isSet: false } },
      estimates: { rows: [], checkedCount: 0, checkableCount: 0, needsValueCount: 0, rankingSource: 'fallback' },
    } as unknown as PreAnalysisModel
    render(createElement(YourDecisionSection, { model, onSendPrompt: vi.fn(), estimateFocus: null }))
    fireEvent.click(screen.getByTestId('pre-analysis-v3-groups-toggle-all'))
    for (const type of ['option', 'risk']) {
      const row = screen.getByTestId(`pre-analysis-v3-entity-${type}`)
      expect(within(row).getByText(LABEL)).toBeInTheDocument()
      expectNoOlumi(row)
    }
    expect(computeGraphFacts(nodes).risksAllOlumi).toBe(false)
    const aiRisk = { ...nodes[1], data: { ...nodes[1].data, provenance: 'ai_inferred' } }
    expect(computeGraphFacts([aiRisk]).risksAllOlumi).toBe(true)
    expect(computeGraphFacts([aiRisk, nodes[1]]).risksAllOlumi).toBe(false)
    const futureRisk = { ...nodes[1], data: { ...nodes[1].data, provenance: 'future_provenance' } }
    expect(projectAuthoredEntities([futureRisk], 'risk')[0].attribution).toEqual({ kind: 'person', displayName: 'You' })
    expect(computeGraphFacts([futureRisk]).risksAllOlumi).toBe(false)
  })

  it('includes the exact neutral words in the canvas legend', () => {
    render(<CanvasLegendPopover variant="controlled" open onOpenChange={vi.fn()} />)
    expect(screen.getAllByText(LABEL).length).toBeGreaterThan(0)
    expect(provenanceKey([factor('unverified_brief')], []).values).toEqual([
      expect.objectContaining({ kind: 'unverified_brief', label: LABEL }),
    ])
  })

  it('keeps ai_inferred attributed to Olumi', () => {
    const node = factor('ai_inferred', 'cee_inference')
    expect(provenanceToPill('ai_inferred')?.label).toBe('AI estimate')
    const row = estimate(node)
    expect(row.aiSourced).toBe(true)
    expect(projectAuthoredEntities([{ ...node, type: 'risk', data: { ...node.data, kind: 'risk' } }], 'risk')[0].attribution).toEqual({ kind: 'olumi' })
    render(createElement(EstimateRow, { row, expanded: false, onToggle: vi.fn() }))
    expect(screen.getByTestId('pre-analysis-v3-estimate-factor-1')).toHaveTextContent('Olumi estimate')
  })

  it('keeps from_brief unchanged', () => {
    const node = factor('from_brief', 'brief_extraction')
    expect(classifyNodeProvenance(node.data.provenance as string)).toEqual({ kind: 'brief', userOwned: false })
    expect(provenanceToPill('from_brief')?.label).toBe('From brief')
    const { container } = render(createElement(NodeProvenanceMark, { nodeType: 'option', data: node.data }))
    expect(screen.getByTestId('node-provenance-mark')).toHaveAccessibleName('From your brief')
    expectNoOlumi(container)
    expect(estimate(node).aiSourced).toBe(false)
  })
})
