import { describe, it, expect } from 'vitest'
import { buildAiDiscussPrompt } from '../buildAiDiscussPrompt'
import { UNRECOGNISED_BIAS_SIGNAL_TITLE } from '../../../shared/biasSignalTitles'

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

  it('retains a recognised category without claiming the user accepted a diagnosis', () => {
    const prompt = buildAiDiscussPrompt({
      kind: 'bias', biasType: 'Confirmation bias',
      observation: 'Only favourable interviews are represented.',
      targetLabel: 'Customer demand',
      microInterventionStep: 'Seek a disconfirming interview.',
    })
    expect(prompt).toContain('Possible reasoning risk: Confirmation bias.')
    expect(prompt).toContain('Only favourable interviews are represented.')
    expect(prompt).toContain('Customer demand')
    expect(prompt).toContain('Suggested technique:')
    expect(prompt).toContain('Seek a disconfirming interview.')
    expect(prompt).toContain('evidence for and against')
    expect(prompt).not.toMatch(/I.m noticing|my thinking|I have .*bias/i)
  })

  it('preserves an uncategorised observation without treating the heading as a bias', () => {
    const observation = 'The lower-risk alternative has not been examined. '.repeat(8)
    const prompt = buildAiDiscussPrompt({
      kind: 'bias', biasType: UNRECOGNISED_BIAS_SIGNAL_TITLE,
      observation, targetLabel: 'Two-week pilot',
    })
    expect(prompt).toContain(JSON.stringify(observation.trim()))
    expect(prompt).toContain('Two-week pilot')
    expect(prompt).not.toContain('Possible reasoning risk:')
    expect(prompt).not.toContain('Suggested technique:')
    expect(prompt).toContain('another plausible explanation')
    expect(prompt).toContain('one practical next check')
  })

  it.each([undefined, null, '', '   '])('names an absent observation honestly (%s)', observation => {
    const prompt = buildAiDiscussPrompt({
      kind: 'bias', biasType: UNRECOGNISED_BIAS_SIGNAL_TITLE,
      observation, targetLabel: null, microInterventionStep: '   ',
    })
    expect(prompt).toContain('No observation was supplied with this check.')
    expect(prompt).toContain('What context or evidence is needed')
    expect(prompt).not.toMatch(/Observation:|Possible reasoning risk:|Related model item:|Suggested technique:|undefined|null/)
  })

  it('builds a goal prompt', () => {
    expect(buildAiDiscussPrompt({ kind: 'goal', label: 'Hit Q3 revenue target' }))
      .toBe('Tell me about the goal "Hit Q3 revenue target". How should I think about success here?')
  })
})
