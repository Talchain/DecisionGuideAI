/**
 * ISL #207: the Model tab's goal-fit row carries the chooser's base-caveat, so
 * a renderer cannot show the figure bare (AIQ #72 5877139338).
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { buildGoalFitRows } from '../buildGoalFitRows'

const nodes = [{ id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A' } }] as unknown as Node[]
const rowFor = (goalLevelAuthor?: 'olumi' | 'unattested') =>
  buildGoalFitRows(nodes, { opt_a: { goal_probability: 0.41, ...(goalLevelAuthor ? { goalLevelAuthor } : {}) } })?.[0]

describe('buildGoalFitRows — base-caveat rides the row', () => {
  it.each([
    ['olumi', 'olumi_estimate'],
    ['unattested', 'from_inputs'],
    [undefined, null],
  ] as const)('author %s → baseCaveat %s', (author, expected) => {
    const row = rowFor(author)
    expect(row?.probability).toBe(0.41)
    expect(row?.baseCaveat).toBe(expected)
  })
})
