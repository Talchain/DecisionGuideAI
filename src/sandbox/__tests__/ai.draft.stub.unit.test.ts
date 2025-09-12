// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { draftScenario } from '@/sandbox/ai/draft'

describe('ai.draft.stub', () => {
  it('returns deterministic nodes/edges tagged as generated', () => {
    const a = draftScenario({ prompt: 'improve onboarding flow', seed: 42 })
    const b = draftScenario({ prompt: 'improve onboarding flow', seed: 42 })
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
    expect(a.nodes.length).toBeGreaterThanOrEqual(4)
    expect(a.edges.length).toBeGreaterThanOrEqual(4)
    expect(a.nodes.every(n => n.meta?.generated === true)).toBe(true)
    expect(a.edges.every(e => e.meta?.generated === true)).toBe(true)
  })
})
