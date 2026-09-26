// @vitest-environment-options {"url": "https://staging--olumi.netlify.app/#/canvas"}
/**
 * ⭐ NO "AI: OpenAI" CHIP ON EVERY STAGING SCREEN (v3.1 design gap #30; Paul, 26 Sep: "needs to be a premium
 * design"). Staging defaults to OpenAI (`resolveAiComparisonMode`), so the chip labelled the default on every
 * screen of the Olumi tab — debug chrome in the product panel. It still shows for a NON-default engine
 * (explicit `?ai=conventional`), which is the comparison it exists for.
 *
 * This file runs jsdom at the STAGING host (the docblock above), so the render row measures the real default.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OlumiTabBody } from '../OlumiTabBody'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useCanvasStore } from '../../store'
import { aiComparisonBadge, aiComparisonLabel, resolveAiComparisonMode } from '../../../v5/aiComparisonMode'

vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: () => new Promise(() => {}),
  streamOrchestratorTurn: async function* () { /* never yields */ },
  OrchestratorError: class extends Error {},
}))
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: () => new Promise(() => {}),
  getV5Endpoint: () => 'https://example.invalid/v5/turn',
}))

describe('the Olumi tab does not label the staging default engine', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({ currentScenarioId: null })
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  })

  it('RED: at the staging host with no ?ai, the panel renders NO engine chip', () => {
    // Precondition: this really is the staging default, OpenAI (not an unconfigured host).
    expect(window.location.hostname).toBe('staging--olumi.netlify.app')
    expect(resolveAiComparisonMode()).toBe('openai')
    render(<ConversationProvider><OlumiTabBody /></ConversationProvider>)
    expect(screen.queryByTestId('olumi-ai-comparison-mode')).toBeNull()
    expect(screen.queryByText(/AI: OpenAI/)).toBeNull()
  })

  it('the badge names only a mode that differs from the host default', () => {
    const staging = 'https://staging--olumi.netlify.app/#/canvas'
    expect(aiComparisonBadge(staging)).toBeNull()
    expect(aiComparisonBadge(`${staging}?ai=openai`)).toBeNull()
    expect(aiComparisonBadge(`${staging}?ai=conventional`)).toBe('Conventional')
    expect(aiComparisonBadge('https://6ab7ebeab5d4da00088e9437--olumi.netlify.app/?ai=conventional#/canvas')).toBe('Conventional')
    // Production has no default engine label: an explicit mode there is non-default, so it is named.
    expect(aiComparisonBadge('https://olumi.example.com/#/canvas')).toBeNull()
    expect(aiComparisonBadge('https://olumi.example.com/#/canvas?ai=openai')).toBe('OpenAI')
  })

  it('CONTRAST: the label itself is unchanged (headers and diagnostics still read it)', () => {
    expect(aiComparisonLabel('https://staging--olumi.netlify.app/#/canvas')).toBe('OpenAI')
  })
})
