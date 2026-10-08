import { describe, expect, it } from 'vitest'
import { changedSinceRunWords } from '../changedSinceRunWords'
import type { ChangedSinceRun } from '../changedSinceRun'

const nodes = [
  { id: 'node-price-id', data: { label: 'Price' } },
  { id: 'node-cost-id', data: { label: 'Cost' } },
  { id: 'node-revenue-id', data: { label: 'Revenue' } },
  { id: 'node-demand-id', data: { label: 'Demand' } },
]
const link = (from: string, to: string) => `${from}\u0000${to}`
const changed = (over: Partial<ChangedSinceRun> = {}): ChangedSinceRun => ({
  sinceRunId: 'run-on-record',
  nodeIds: new Set(['node-price-id']),
  linkKeys: new Set(),
  unattributedChanges: 0,
  complete: true,
  ...over,
})

describe('changedSinceRunWords: the exact changed-since-Run sentences', () => {
  it('one named node', () => {
    expect(changedSinceRunWords(changed(), nodes)).toBe('Changed since your last Run: ‘Price’.')
  })

  it('one named node and a directed link', () => {
    const value = changed({ linkKeys: new Set([link('node-price-id', 'node-revenue-id')]) })
    expect(changedSinceRunWords(value, nodes)).toBe(
      'Changed since your last Run: ‘Price’ and the link from ‘Price’ to ‘Revenue’.',
    )
  })

  it('a link alone uses its current endpoint labels', () => {
    const value = changed({ nodeIds: new Set(), linkKeys: new Set([link('node-revenue-id', 'node-price-id')]) })
    expect(changedSinceRunWords(value, nodes)).toBe(
      'Changed since your last Run: the link from ‘Revenue’ to ‘Price’.',
    )
  })

  it('three named items use a natural list', () => {
    const value = changed({ nodeIds: new Set(['node-price-id', 'node-cost-id', 'node-revenue-id']) })
    expect(changedSinceRunWords(value, nodes)).toBe('Changed since your last Run: ‘Price’, ‘Cost’, and ‘Revenue’.')
  })

  it('caps at three named items with the exact design remainder', () => {
    const value = changed({
      nodeIds: new Set(['node-price-id', 'node-cost-id']),
      linkKeys: new Set([
        link('node-price-id', 'node-revenue-id'),
        link('node-cost-id', 'node-revenue-id'),
        link('node-demand-id', 'node-revenue-id'),
      ]),
    })
    expect(changedSinceRunWords(value, nodes)).toBe(
      'Changed since your last Run: ‘Price’, ‘Cost’, the link from ‘Price’ to ‘Revenue’, and 2 more.',
    )
  })

  it('adds the exact unattributed tail', () => {
    expect(changedSinceRunWords(changed({ unattributedChanges: 2 }), nodes)).toBe(
      'Changed since your last Run: ‘Price’ and 2 other changes.',
    )
  })

  it('combines the remainder and unattributed tails naturally', () => {
    const value = changed({
      nodeIds: new Set(['node-price-id', 'node-cost-id', 'node-revenue-id', 'node-demand-id', 'deleted-id']),
      unattributedChanges: 2,
    })
    expect(changedSinceRunWords(value, nodes)).toBe(
      'Changed since your last Run: ‘Price’, ‘Cost’, ‘Revenue’, 2 more, and 2 other changes.',
    )
  })

  it('only unattributed changes use the exact design sentence', () => {
    expect(changedSinceRunWords(changed({ nodeIds: new Set(), unattributedChanges: 2 }), nodes)).toBe(
      '2 changes since your last Run.',
    )
  })

  it('only one unattributed change uses singular grammar', () => {
    expect(changedSinceRunWords(changed({ nodeIds: new Set(), unattributedChanges: 1 }), nodes)).toBe(
      '1 change since your last Run.',
    )
  })

  it('one unattributed tail uses singular grammar', () => {
    expect(changedSinceRunWords(changed({ unattributedChanges: 1 }), nodes)).toBe(
      'Changed since your last Run: ‘Price’ and 1 other change.',
    )
  })

  it('partial named lists keep their names and append the exact qualifier', () => {
    expect(changedSinceRunWords(changed({ complete: false }), nodes)).toBe(
      'Changed since your last Run: ‘Price’. This list may be incomplete.',
    )
  })

  it('partial unattributed lists append the same qualifier', () => {
    expect(changedSinceRunWords(changed({ nodeIds: new Set(), unattributedChanges: 2, complete: false }), nodes)).toBe(
      '2 changes since your last Run. This list may be incomplete.',
    )
  })

  it('missing and deleted nodes still count without exposing their IDs', () => {
    const value = changed({ nodeIds: new Set(['node-price-id', 'missing-node-id', 'deleted-node-id']) })
    expect(changedSinceRunWords(value, nodes)).toBe('Changed since your last Run: ‘Price’ and 2 more.')
  })

  it('a link with one missing endpoint still counts without inventing labels', () => {
    const value = changed({ linkKeys: new Set([link('node-price-id', 'missing-endpoint-id')]) })
    expect(changedSinceRunWords(value, nodes)).toBe('Changed since your last Run: ‘Price’ and 1 more.')
  })

  it('missing elements do not consume a named-item slot', () => {
    const value = changed({ nodeIds: new Set(['missing-node-id', 'node-price-id', 'node-cost-id', 'node-revenue-id']) })
    expect(changedSinceRunWords(value, nodes)).toBe('Changed since your last Run: ‘Price’, ‘Cost’, ‘Revenue’, and 1 more.')
  })

  it('all unnamed elements use the count fallback and never their IDs', () => {
    const value = changed({ nodeIds: new Set(['missing-node-id', 'deleted-node-id']) })
    expect(changedSinceRunWords(value, nodes)).toBe('Changed since your last Run: 2 items.')
  })

  it('a single unnamed element uses a singular count fallback', () => {
    expect(changedSinceRunWords(changed(), [])).toBe('Changed since your last Run: 1 item.')
  })

  it('unnamed elements and unattributed changes retain their separate counts', () => {
    const value = changed({ nodeIds: new Set(['missing-node-id', 'deleted-node-id']), unattributedChanges: 2 })
    expect(changedSinceRunWords(value, nodes)).toBe('Changed since your last Run: 2 items and 2 other changes.')
  })

  it('blank, non-string, glossary-banned labels use the count fallback', () => {
    const value = changed({ nodeIds: new Set(['blank-id', 'number-id', 'contest-id', 'glossary-id']) })
    const unsafeNodes = [
      { id: 'blank-id', data: { label: '   ' } },
      { id: 'number-id', data: { label: 12 } },
      { id: 'contest-id', data: { label: 'winner' } },
      { id: 'glossary-id', data: { label: 'Graph rewrite' } },
    ]
    expect(changedSinceRunWords(value, unsafeNodes)).toBe('Changed since your last Run: 4 items.')
  })

  it('trims current canvas labels', () => {
    const currentNodes = [{ id: 'node-price-id', data: { label: '  New price  ' } }]
    expect(changedSinceRunWords(changed(), currentNodes)).toBe('Changed since your last Run: ‘New price’.')
  })

  it('truncates a label to the existing 48-character display policy', () => {
    const currentNodes = [{ id: 'node-price-id', data: { label: 'x'.repeat(60) } }]
    expect(changedSinceRunWords(changed(), currentNodes)).toBe(`Changed since your last Run: ‘${'x'.repeat(47)}…’.`)
  })

  it('vets after truncation when the cut makes a banned term quotable', () => {
    const longLabel = `${'x'.repeat(41)} graphite dashboards`
    const currentNodes = [{ id: 'node-price-id', data: { label: longLabel } }]
    expect(changedSinceRunWords(changed(), currentNodes)).toBe('Changed since your last Run: 1 item.')
  })

  it('does not name a link whose endpoint label is unquotable', () => {
    const value = changed({ linkKeys: new Set([link('node-price-id', 'unsafe-endpoint-id')]) })
    const currentNodes = [...nodes, { id: 'unsafe-endpoint-id', data: { label: 'Graph rewrite' } }]
    expect(changedSinceRunWords(value, currentNodes)).toBe('Changed since your last Run: ‘Price’ and 1 more.')
  })

  it('a null Run anchor is silent even with named changes', () => {
    expect(changedSinceRunWords(changed({ sinceRunId: null }), nodes)).toBeNull()
  })

  it('an empty set is silent even when partial', () => {
    expect(changedSinceRunWords(changed({ nodeIds: new Set(), complete: false }), nodes)).toBeNull()
  })
})

describe('changedSinceRunWords: no author is claimed', () => {
  it('the set holds the user\'s AND Olumi\'s applied changes, so the words never say "you changed"', () => {
    const words = [
      changedSinceRunWords(changed(), nodes),
      changedSinceRunWords(changed({ linkKeys: new Set([link('node-price-id', 'node-revenue-id')]), unattributedChanges: 2 }), nodes),
      changedSinceRunWords(changed({ nodeIds: new Set(), unattributedChanges: 1 }), nodes),
    ]
    expect(words).toEqual([
      'Changed since your last Run: ‘Price’.',
      'Changed since your last Run: ‘Price’, the link from ‘Price’ to ‘Revenue’, and 2 other changes.',
      '1 change since your last Run.',
    ])
    for (const w of words) expect(w).not.toMatch(/\byou (?:changed|edited|added|removed)\b/i)
  })
})
