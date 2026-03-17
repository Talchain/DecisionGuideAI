import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { linkifyCoachingText } from '../linkifyCoachingText'

// Mock focusHelpers to prevent actual canvas operations
vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusByTarget: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
  focusNodeById: vi.fn(),
}))

describe('linkifyCoachingText', () => {
  const entities = [
    { label: 'Option A', nodeId: 'opt-a' },
    { label: 'Engineering Capacity', nodeId: 'fac-eng' },
    { label: 'Revenue Growth', nodeId: 'fac-rev' },
  ]

  it('returns plain text when no entities match', () => {
    const result = linkifyCoachingText('No matches here', entities)
    expect(result).toEqual(['No matches here'])
  })

  it('returns plain text when entities array is empty', () => {
    const result = linkifyCoachingText('Option A is best', [])
    expect(result).toEqual(['Option A is best'])
  })

  it('returns plain text when text is empty', () => {
    const result = linkifyCoachingText('', entities)
    expect(result).toEqual([''])
  })

  it('wraps a single matching entity in GraphLink', () => {
    const { container } = render(
      <>{linkifyCoachingText('Invest in Option A for best results', entities)}</>
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toBe('Option A')
  })

  it('wraps multiple matching entities', () => {
    const { container } = render(
      <>{linkifyCoachingText('Option A depends on Engineering Capacity', entities)}</>
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].textContent).toBe('Option A')
    expect(buttons[1].textContent).toBe('Engineering Capacity')
  })

  it('limits to max 4 GraphLinks', () => {
    const manyEntities = [
      { label: 'A', nodeId: '1' },
      { label: 'B', nodeId: '2' },
      { label: 'C', nodeId: '3' },
      { label: 'D', nodeId: '4' },
      { label: 'E', nodeId: '5' },
    ]
    const { container } = render(
      <>{linkifyCoachingText('A then B then C then D then E', manyEntities)}</>
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeLessThanOrEqual(4)
  })

  it('uses word-boundary matching (no partial matches)', () => {
    const ents = [{ label: 'Cost', nodeId: 'cost' }]
    const { container } = render(
      <>{linkifyCoachingText('Costly approach but Cost is important', ents)}</>
    )
    const buttons = container.querySelectorAll('button')
    // Should match "Cost" standalone but not "Cost" inside "Costly"
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toBe('Cost')
  })

  it('skips matches inside parentheses', () => {
    const ents = [{ label: 'Developers', nodeId: 'dev' }]
    const { container } = render(
      <>{linkifyCoachingText('Team (0=Developers, 1=Tech lead) has Developers involved', ents)}</>
    )
    const buttons = container.querySelectorAll('button')
    // Should match the standalone "Developers" but not the one inside parens
    expect(buttons).toHaveLength(1)
  })

  it('skips matches adjacent to numbers', () => {
    const ents = [{ label: 'Growth', nodeId: 'growth' }]
    const { container } = render(
      <>{linkifyCoachingText('Growth: 0.45 means Growth is moderate', ents)}</>
    )
    // Both "Growth" instances match: colon-after is not a skip trigger (only digit/decimal after).
    // The skip rule targets patterns like "0.45Growth" or ":Growth", not "Growth:".
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
  })

  it('prefers longest match (greedy)', () => {
    const ents = [
      { label: 'Revenue', nodeId: 'rev' },
      { label: 'Revenue Growth', nodeId: 'rev-growth' },
    ]
    const { container } = render(
      <>{linkifyCoachingText('Revenue Growth is the key driver', ents)}</>
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toBe('Revenue Growth')
  })

  it('skips entities without nodeId or edgeId', () => {
    const ents = [
      { label: 'Option A' }, // no nodeId
      { label: 'Option B', nodeId: 'opt-b' },
    ]
    const { container } = render(
      <>{linkifyCoachingText('Compare Option A with Option B', ents)}</>
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toBe('Option B')
  })
})
