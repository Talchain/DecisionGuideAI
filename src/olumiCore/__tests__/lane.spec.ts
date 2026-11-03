import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { coreLaneAllows, coreLaneShowsSurface, coreLaneHasAccounts, isOlumiCoreLane } from '../lane'
import { resolveAiComparisonMode, aiComparisonHeaders } from '../../v5/aiComparisonMode'
import { streamedDraftEligible } from '../../canvas/conversation/useConversation'
import { preloadPrompts } from '../../lib/prompt-preloader'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('the olumi-core lane', () => {
  it('is off unless the build says so, and then nothing is hidden or changed', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(isOlumiCoreLane()).toBe(false)
    expect(coreLaneAllows('structure')).toBe(true)
    expect(coreLaneShowsSurface('compare')).toBe(true)
    expect(coreLaneShowsSurface('analysisNew')).toBe(true)
    expect(resolveAiComparisonMode('https://example.com/#/canvas')).toBeNull()
  })

  it('honours a typed figure and nothing structural (what olumi-core cannot honour is not offered)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    expect(isOlumiCoreLane()).toBe(true)
    expect(coreLaneAllows('figure')).toBe(true)
    expect(coreLaneAllows('structure')).toBe(false)
  })

  it('hides the dock surfaces with no View source (Reasoning, Compare, and Model, which reads legacy node shapes: review 00002 #4) and keeps Analysis, the chat and Team', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    for (const gone of ['compare', 'analysisNew', 'diagnostics']) expect(coreLaneShowsSurface(gone)).toBe(false)
    for (const keep of ['results', 'olumi', 'team']) expect(coreLaneShowsSurface(keep)).toBe(true)
  })

  it('is the core route on every host and whatever the link says, so no URL needs ?ai=core and none can pick another lane', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    for (const href of ['https://olumi-dgai.onrender.com/#/canvas', 'https://x.test/#/canvas?ai=openai', 'https://x.test/?ai=conventional#/scenario/abc']) expect(resolveAiComparisonMode(href)).toBe('core-route')
    expect(aiComparisonHeaders('https://x.test/')).toEqual({ 'x-olumi-ai-mode': 'core-route' })
  })

  it('never opens the draft stream (olumi-core has none: the route would 404 first on every brief) and never warms CEE\'s prompt cache', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetchSpy)
    const draft = { turnType: 'conversation' as const, derivedStage: 'frame', isSystemEvent: false, nodeCountAtDispatch: 0 }
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(streamedDraftEligible(draft)).toBe(true)
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    expect(streamedDraftEligible(draft)).toBe(false)
    await preloadPrompts()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('has no accounts: the sign-in, profile and delete-account chrome (nothing is behind it) is not offered', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(coreLaneHasAccounts()).toBe(true)
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    expect(coreLaneHasAccounts()).toBe(false)
  })
})
