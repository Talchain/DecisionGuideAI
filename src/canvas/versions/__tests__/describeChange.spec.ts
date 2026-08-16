/**
 * Caption layer — behaviour pinned.
 *
 * The governing property: every line traces to a field in the changeset. There
 * is no line this module can emit that the diff did not find, and the
 * "fabricates nothing" tests below are what keep that true.
 */

import { describe, it, expect } from 'vitest'
import { buildVersionLabelIndex, describeChangeset, formatFieldValue } from '../describeChange'
import { diffModelVersions } from '../diffModelVersions'
import type { ModelVersion, VersionedEdge, VersionedNode } from '../types'

function node(
  id: string,
  label: string,
  fields: Record<string, string | number | boolean | null> = {},
  kind = 'factor',
): VersionedNode {
  return { id, kind, label, fields }
}

function edge(
  id: string,
  from: string,
  to: string,
  fields: Record<string, string | number | boolean | null> = {},
): VersionedEdge {
  return { id, from, to, fields }
}

function version(id: string, nodes: VersionedNode[], edges: VersionedEdge[]): ModelVersion {
  return { id, name: `version ${id}`, createdAt: 1, origin: 'manual', nodes, edges }
}

/** Captions the way the panel does it: with a complete label index. */
function textOf(before: ModelVersion, after: ModelVersion): string[] {
  return describeChangeset(
    diffModelVersions(before, after),
    buildVersionLabelIndex(before, after),
  ).map((l) => l.text)
}

describe('formatFieldValue', () => {
  it('renders absence as "not set", never as a substituted value', () => {
    expect(formatFieldValue(null)).toBe('not set')
  })

  it('renders zero as zero, not as absence', () => {
    expect(formatFieldValue(0)).toBe('0')
  })

  it('renders an empty string distinctly from absence', () => {
    expect(formatFieldValue('')).toBe('empty')
  })

  it('renders booleans in plain words', () => {
    expect(formatFieldValue(true)).toBe('yes')
    expect(formatFieldValue(false)).toBe('no')
  })

  it('trims binary floating-point noise without changing the value', () => {
    expect(formatFieldValue(0.1 + 0.2)).toBe('0.3')
    expect(formatFieldValue(0.8)).toBe('0.8')
  })

  it('quotes strings so an empty-looking value is unambiguous', () => {
    expect(formatFieldValue('user_set')).toBe('"user_set"')
  })
})

describe('describeChangeset', () => {
  it('produces no lines at all for an empty changeset', () => {
    const v = version('a', [node('n1', 'Price')], [])

    expect(describeChangeset(diffModelVersions(v, v))).toEqual([])
  })

  it('describes an added node by kind and name', () => {
    const a = version('a', [], [])
    const b = version('b', [node('n1', 'Price', {}, 'factor')], [])

    expect(textOf(a, b)).toEqual(['Factor "Price" added'])
  })

  it('describes a removed node', () => {
    const a = version('a', [node('n1', 'Price', {}, 'risk')], [])
    const b = version('b', [], [])

    expect(textOf(a, b)).toEqual(['Risk "Price" removed'])
  })

  it('describes a value change with both the before and after values', () => {
    const a = version('a', [node('n1', 'Price', { 'observedState.value': 0.5 })], [])
    const b = version('b', [node('n1', 'Price', { 'observedState.value': 0.8 })], [])

    expect(textOf(a, b)).toEqual(['Factor "Price" value 0.5 → 0.8'])
  })

  it('describes a rename using the field word "name"', () => {
    const a = version('a', [node('n1', 'Price')], [])
    const b = version('b', [node('n1', 'Unit price')], [])

    expect(textOf(a, b)).toEqual(['Factor "Unit price" name "Price" → "Unit price"'])
  })

  it('names edges by their endpoint labels, not raw ids', () => {
    const nodes = [node('n1', 'Price'), node('n2', 'Revenue')]
    const a = version('a', nodes, [])
    const b = version('b', nodes, [edge('e1', 'n1', 'n2')])

    expect(textOf(a, b)).toEqual(['Link Price → Revenue added'])
  })

  it('resolves a removed edge label from the earlier version', () => {
    const nodes = [node('n1', 'Price'), node('n2', 'Revenue')]
    const a = version('a', nodes, [edge('e1', 'n1', 'n2')])
    const b = version('b', nodes, [])

    expect(textOf(a, b)).toEqual(['Link Price → Revenue removed'])
  })

  it('falls back to the raw id when an endpoint cannot be resolved', () => {
    const a = version('a', [], [])
    const b = version('b', [], [edge('e1', 'ghost1', 'ghost2')])

    expect(textOf(a, b)).toEqual(['Link ghost1 → ghost2 added'])
  })

  it('resolves an unchanged endpoint only when given a complete index', () => {
    // The changeset alone cannot name a node that did not change, so the
    // changeset-only default degrades to raw ids rather than inventing a name.
    const nodes = [node('n1', 'Price'), node('n2', 'Revenue')]
    const a = version('a', nodes, [edge('e1', 'n1', 'n2', { weight: 0.5 })])
    const b = version('b', nodes, [edge('e1', 'n1', 'n2', { weight: 0.9 })])
    const changeset = diffModelVersions(a, b)

    expect(describeChangeset(changeset).map((l) => l.text)).toEqual([
      'Link n1 → n2 strength 0.5 → 0.9',
    ])
    expect(
      describeChangeset(changeset, buildVersionLabelIndex(a, b)).map((l) => l.text),
    ).toEqual(['Link Price → Revenue strength 0.5 → 0.9'])
  })

  it('prefers the later label when a node was renamed', () => {
    const a = version('a', [node('n1', 'Price'), node('n2', 'Revenue')], [])
    const b = version('b', [node('n1', 'Unit price'), node('n2', 'Revenue')], [])

    expect(buildVersionLabelIndex(a, b).get('n1')).toBe('Unit price')
  })

  it('describes an edge strength change using the user-facing word', () => {
    const nodes = [node('n1', 'Price'), node('n2', 'Revenue')]
    const a = version('a', nodes, [edge('e1', 'n1', 'n2', { weight: 0.5 })])
    const b = version('b', nodes, [edge('e1', 'n1', 'n2', { weight: 0.9 })])

    expect(textOf(a, b)).toEqual(['Link Price → Revenue strength 0.5 → 0.9'])
  })

  it('renders an unmapped field under its raw name rather than hiding it', () => {
    const a = version('a', [node('n1', 'Price', { some_new_field: 1 })], [])
    const b = version('b', [node('n1', 'Price', { some_new_field: 2 })], [])

    expect(textOf(a, b)).toEqual(['Factor "Price" some_new_field 1 → 2'])
  })

  it('renders a newly-set field as coming from "not set"', () => {
    const a = version('a', [node('n1', 'Price', {})], [])
    const b = version('b', [node('n1', 'Price', { utility: 0.4 })], [])

    expect(textOf(a, b)).toEqual(['Factor "Price" payoff not set → 0.4'])
  })

  it('orders structure before detail: additions, removals, then modifications', () => {
    const a = version('a', [node('n1', 'Price', { utility: 1 }), node('n2', 'Gone')], [])
    const b = version('b', [node('n1', 'Price', { utility: 2 }), node('n3', 'New')], [])

    expect(textOf(a, b)).toEqual([
      'Factor "New" added',
      'Factor "Gone" removed',
      'Factor "Price" payoff 1 → 2',
    ])
  })

  it('emits one line per changed field, each separately keyed', () => {
    const a = version('a', [node('n1', 'Price', { utility: 1, body: 'a' })], [])
    const b = version('b', [node('n1', 'Price', { utility: 2, body: 'c' })], [])

    const lines = describeChangeset(diffModelVersions(a, b))

    expect(lines).toHaveLength(2)
    expect(new Set(lines.map((l) => l.key)).size).toBe(2)
  })

  it('tags every line with its scope and kind for rendering', () => {
    const nodes = [node('n1', 'Price'), node('n2', 'Revenue')]
    const a = version('a', nodes, [])
    const b = version('b', [...nodes, node('n3', 'Cost')], [edge('e1', 'n1', 'n2')])

    const lines = describeChangeset(diffModelVersions(a, b))

    expect(lines.find((l) => l.text.includes('Cost'))).toMatchObject({
      scope: 'node',
      kind: 'added',
    })
    expect(lines.find((l) => l.text.startsWith('Link'))).toMatchObject({
      scope: 'edge',
      kind: 'added',
    })
  })

  it('fabricates no summary, judgement or count line', () => {
    const a = version('a', [node('n1', 'Price', { utility: 1 })], [])
    const b = version('b', [node('n1', 'Price', { utility: 2 }), node('n2', 'Cost')], [])

    const joined = textOf(a, b).join(' | ').toLowerCase()

    for (const forbidden of ['major', 'significant', 'improved', 'weakened', 'you made', 'changes in total']) {
      expect(joined).not.toContain(forbidden)
    }
  })

  it('emits exactly as many lines as the changeset has recorded changes', () => {
    const a = version('a', [node('n1', 'A', { x: 1 }), node('n2', 'B')], [edge('e1', 'n1', 'n2')])
    const b = version('b', [node('n1', 'A', { x: 2 }), node('n3', 'C')], [])

    const changeset = diffModelVersions(a, b)
    const expected =
      changeset.addedNodes.length +
      changeset.removedNodes.length +
      changeset.addedEdges.length +
      changeset.removedEdges.length +
      changeset.modifiedNodes.reduce((n, c) => n + c.fields.length, 0) +
      changeset.modifiedEdges.reduce((n, c) => n + c.fields.length, 0)

    expect(describeChangeset(changeset)).toHaveLength(expected)
  })
})
