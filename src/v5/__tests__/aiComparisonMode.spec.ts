import { describe, expect, it } from 'vitest'
import { aiComparisonBadge, aiComparisonHeaders, aiComparisonLabel, isOpenAiLane, resolveAiComparisonMode } from '../aiComparisonMode'

describe('AI comparison mode', () => {
  it('⭐ DL 22 Oct: staging defaults to the core route, so a plain link reaches it and never the conventional (Anthropic) route', () => {
    const url = 'https://staging--olumi.netlify.app/#/canvas?diag=1'
    expect(resolveAiComparisonMode(url)).toBe('core-route')
    expect(aiComparisonLabel(url)).toBe('OpenAI core route')
    expect(aiComparisonHeaders(url)).toEqual({ 'x-olumi-ai-mode': 'core-route' })
    expect(aiComparisonHeaders('https://staging--olumi.netlify.app/')).toEqual({ 'x-olumi-ai-mode': 'core-route' })
    expect(resolveAiComparisonMode('https://deploy-preview-2044--olumi.netlify.app/#/canvas')).toBe('core-route')
  })

  it('⭐ `ai=core` (the surface the core route replaces) reaches the core route, in the hash or the page query', () => {
    expect(aiComparisonHeaders('https://staging--olumi.netlify.app/#/canvas?ai=core&diag=1')).toEqual({ 'x-olumi-ai-mode': 'core-route' })
    expect(resolveAiComparisonMode('https://staging--olumi.netlify.app/?ai=core#/canvas')).toBe('core-route')
    expect(resolveAiComparisonMode('https://app.olumi.app/#/canvas?ai=core')).toBe('core-route')
  })

  it('CONTRAST: openai and conventional stay explicit surfaces of their own', () => {
    const openai = 'https://staging--olumi.netlify.app/#/canvas?diag=1&ai=openai'
    expect(resolveAiComparisonMode(openai)).toBe('openai')
    expect(aiComparisonLabel(openai)).toBe('OpenAI')
    expect(aiComparisonHeaders(openai)).toEqual({ 'x-olumi-ai-mode': 'openai' })
    expect(resolveAiComparisonMode('https://staging--olumi.netlify.app/#/canvas?ai=conventional&diag=1')).toBe('conventional')
    expect(isOpenAiLane('openai')).toBe(true)
    expect(isOpenAiLane('core-route')).toBe(true)
    expect(isOpenAiLane('conventional')).toBe(false)
  })

  it('DL-3 20 Oct (Paul 23:24Z opened `?ai=core.` and silently ran the default lane): case, spaces and trailing punctuation are folded; any other spelling is still no mode', () => {
    const at = (ai: string) => resolveAiComparisonMode(`https://app.olumi.app/#/canvas?ai=${encodeURIComponent(ai)}`)
    for (const typed of ['core.', 'Core', ' core ', 'CORE!', 'core.)']) expect(at(typed), typed).toBe('core-route')
    expect(at('Conventional.')).toBe('conventional')
    expect(at('OpenAI.')).toBe('openai')
    for (const near of ['cored', 'co re', 'ccore', 'c']) expect(at(near), near).toBeNull()
    expect(aiComparisonHeaders('https://staging--olumi.netlify.app/?ai=core.#/canvas')).toEqual({ 'x-olumi-ai-mode': 'core-route' })
  })

  it('DL-3 20 Oct: on staging the badge always names the serving engine, the default included; production names only an explicit mode', () => {
    expect(aiComparisonBadge('https://staging--olumi.netlify.app/#/canvas')).toBe('OpenAI core route')
    expect(aiComparisonBadge('https://staging--olumi.netlify.app/#/canvas?ai=openai')).toBe('OpenAI')
    expect(aiComparisonBadge('https://app.olumi.app/#/canvas')).toBeNull()
    expect(aiComparisonBadge('https://app.olumi.app/#/canvas?ai=core')).toBe('OpenAI core route')
  })

  it('does not override production when no explicit comparison mode exists', () => {
    expect(resolveAiComparisonMode('https://app.olumi.app/#/canvas')).toBeNull()
    expect(aiComparisonHeaders('https://app.olumi.app/#/canvas')).toEqual({})
  })
})
