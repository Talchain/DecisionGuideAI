import { describe, it, expect } from 'vitest'
import { buildAiDiscussPrompt } from '../buildAiDiscussPrompt'

describe('buildAiDiscussPrompt', () => {
  it('builds a factor prompt', () => {
    expect(buildAiDiscussPrompt({ kind: 'factor', label: 'Direct Delivery Capacity' }))
      .toBe('Tell me about Direct Delivery Capacity. How does it affect my decision and what should I consider?')
  })

  it('builds an edge prompt', () => {
    expect(buildAiDiscussPrompt({ kind: 'edge', from: 'Capacity', to: 'On-time Delivery' }))
      .toBe('Tell me about the relationship between Capacity and On-time Delivery. How important is it?')
  })

  it('builds an option prompt', () => {
    expect(buildAiDiscussPrompt({ kind: 'option', label: 'Hire two engineers' }))
      .toBe('Tell me about Hire two engineers. What are its strengths and weaknesses?')
  })

  it('builds a bias prompt', () => {
    expect(buildAiDiscussPrompt({ kind: 'bias', biasType: 'confirmation bias' }))
      .toBe('Tell me more about confirmation bias and how it might affect my thinking.')
  })

  it('builds a goal prompt', () => {
    expect(buildAiDiscussPrompt({ kind: 'goal', label: 'Hit Q3 revenue target' }))
      .toBe('Tell me about the goal "Hit Q3 revenue target". How should I think about success here?')
  })
})
