import { describe, expect, it } from 'vitest'
import { aiComparisonHeaders, aiComparisonLabel, resolveAiComparisonMode } from '../aiComparisonMode'

describe('AI comparison mode', () => {
  it('defaults staging to OpenAI, so a plain link never reaches the conventional (Anthropic) route', () => {
    const url = 'https://staging--olumi.netlify.app/#/canvas?diag=1'
    expect(resolveAiComparisonMode(url)).toBe('openai')
    expect(aiComparisonLabel(url)).toBe('OpenAI')
    expect(aiComparisonHeaders(url)).toEqual({ 'x-olumi-ai-mode': 'openai' })
  })

  it('defaults a plain staging root and a deploy preview to OpenAI too', () => {
    expect(aiComparisonHeaders('https://staging--olumi.netlify.app/')).toEqual({ 'x-olumi-ai-mode': 'openai' })
    expect(resolveAiComparisonMode('https://deploy-preview-2044--olumi.netlify.app/#/canvas')).toBe('openai')
  })

  it('makes OpenAI an explicit separate staging surface', () => {
    const url = 'https://staging--olumi.netlify.app/#/canvas?diag=1&ai=openai'
    expect(resolveAiComparisonMode(url)).toBe('openai')
    expect(aiComparisonLabel(url)).toBe('OpenAI')
    expect(aiComparisonHeaders(url)).toEqual({ 'x-olumi-ai-mode': 'openai' })
  })

  it('allows an explicit conventional URL even when other query state is present', () => {
    const url = 'https://staging--olumi.netlify.app/#/canvas?ai=conventional&diag=1'
    expect(resolveAiComparisonMode(url)).toBe('conventional')
  })

  it('does not override production when no explicit comparison mode exists', () => {
    expect(resolveAiComparisonMode('https://app.olumi.app/#/canvas')).toBeNull()
    expect(aiComparisonHeaders('https://app.olumi.app/#/canvas')).toEqual({})
  })
})
