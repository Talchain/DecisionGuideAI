import { describe, it, expect } from 'vitest'
import { diversifyTriageItems } from '../diversifyTriageItems'
import type { ImprovementItem } from '../../hooks/usePreAnalysisData'

function makeItem(id: string, sourceFactor: string, focusType: 'node' | 'edge' = 'node'): ImprovementItem {
  return {
    key: id,
    category: 'verify',
    label: id,
    detail: '',
    focus: { type: focusType, id: focusType === 'node' ? sourceFactor : id, label: id },
  }
}

const noEdges: { id: string; source: string }[] = []

describe('diversifyTriageItems', () => {
  it('returns empty when input is empty', () => {
    const result = diversifyTriageItems([], noEdges)
    expect(result.top3).toEqual([])
    expect(result.quickFix).toEqual([])
  })

  it('fills top3 with items from different source factors', () => {
    const items = [
      makeItem('dev_cap_value', 'fac_dev'),
      makeItem('dev_cap_edge1', 'fac_dev'),
      makeItem('dev_cap_edge2', 'fac_dev'),
      makeItem('team_size_value', 'fac_team'),
      makeItem('demand_value', 'fac_demand'),
      makeItem('quality_edge', 'fac_quality'),
    ]
    const result = diversifyTriageItems(items, noEdges)
    expect(result.top3.map(i => i.key)).toEqual(['dev_cap_value', 'team_size_value', 'demand_value'])
    // Remaining items in original priority order (dev_cap_edge1 before dev_cap_edge2)
    expect(result.quickFix.map(i => i.key)).toEqual(['dev_cap_edge1', 'dev_cap_edge2', 'quality_edge'])
  })

  it('resolves edge items to source node for dedup', () => {
    const items = [
      makeItem('fac_a_value', 'fac_a', 'node'),
      makeItem('edge_a_to_b', 'fac_a', 'edge'),
      makeItem('fac_b_value', 'fac_b', 'node'),
      makeItem('fac_c_value', 'fac_c', 'node'),
    ]
    const edges = [{ id: 'edge_a_to_b', source: 'fac_a' }]
    const result = diversifyTriageItems(items, edges)
    // edge_a_to_b resolves to fac_a (same source), so it gets deduped
    expect(result.top3.map(i => i.key)).toEqual(['fac_a_value', 'fac_b_value', 'fac_c_value'])
    expect(result.quickFix.map(i => i.key)).toEqual(['edge_a_to_b'])
  })

  it('handles fewer than 3 unique sources', () => {
    const items = [
      makeItem('a1', 'fac_a'),
      makeItem('a2', 'fac_a'),
      makeItem('a3', 'fac_a'),
    ]
    const result = diversifyTriageItems(items, noEdges)
    expect(result.top3.map(i => i.key)).toEqual(['a1'])
    expect(result.quickFix.map(i => i.key)).toEqual(['a2', 'a3'])
  })

  it('preserves priority order within quickFix', () => {
    const items = [
      makeItem('a1', 'fac_a'),
      makeItem('a2', 'fac_a'),
      makeItem('b1', 'fac_b'),
      makeItem('a3', 'fac_a'),
      makeItem('c1', 'fac_c'),
      makeItem('a4', 'fac_a'),
      makeItem('d1', 'fac_d'),
    ]
    const result = diversifyTriageItems(items, noEdges)
    expect(result.top3.map(i => i.key)).toEqual(['a1', 'b1', 'c1'])
    // First 3 remaining in original priority order
    expect(result.quickFix.map(i => i.key)).toEqual(['a2', 'a3', 'a4'])
  })

  it('allows same-source item when influence > 2x next unique-source', () => {
    const items = [
      makeItem('a1', 'fac_a'),
      makeItem('a2', 'fac_a'),
      makeItem('b1', 'fac_b'),
    ]
    // a2 influence=0.9, b1 influence=0.3 → 0.9 > 2*0.3 → a2 stays in top3
    const influenceMap = new Map([
      ['fac_a', 0.9],
      ['fac_b', 0.3],
    ])
    const result = diversifyTriageItems(items, noEdges, influenceMap)
    expect(result.top3.map(i => i.key)).toEqual(['a1', 'a2', 'b1'])
    expect(result.quickFix).toEqual([])
  })

  it('demotes same-source item when influence is NOT > 2x next unique-source', () => {
    const items = [
      makeItem('a1', 'fac_a'),
      makeItem('a2', 'fac_a'),
      makeItem('b1', 'fac_b'),
    ]
    // a2 influence=0.5, b1 influence=0.4 → 0.5 is NOT > 2*0.4=0.8 → a2 demoted
    const influenceMap = new Map([
      ['fac_a', 0.5],
      ['fac_b', 0.4],
    ])
    const result = diversifyTriageItems(items, noEdges, influenceMap)
    expect(result.top3.map(i => i.key)).toEqual(['a1', 'b1'])
    expect(result.quickFix.map(i => i.key)).toEqual(['a2'])
  })

  it('treats items without focus as unique', () => {
    const items: ImprovementItem[] = [
      { key: 'no_focus_1', category: 'fix', label: 'Fix 1', detail: '' },
      { key: 'no_focus_2', category: 'fix', label: 'Fix 2', detail: '' },
      makeItem('a1', 'fac_a'),
    ]
    const result = diversifyTriageItems(items, noEdges)
    expect(result.top3.map(i => i.key)).toEqual(['no_focus_1', 'no_focus_2', 'a1'])
  })
})
