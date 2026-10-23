// @vitest-environment-options {"url": "https://staging--olumi.netlify.app/#/canvas"}
/**
 * ⭐ THE SERVING ENGINE IS ALWAYS NAMED ON STAGING, ITS DEFAULT INCLUDED (DL-3, 20 Oct; replaces the 26 Sep "no default
 * label" rule of v3.1 design gap #30). Paul's 23:24Z session opened `?ai=core.`, fell silently to the default lane and
 * tested it as core: the panel said nothing. A tester must never test one engine as another.
 *
 * This file runs jsdom at the STAGING host (the docblock above), so the render row measures the real default.
 *
 * ⭐ 23 Oct 2026 (vision spec §3): the label shows only in a debug view (`?diag`, the app's existing debug gate). A
 * user's dock carries no route label; a tester opens `?diag=1` to see which engine is serving.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

describe('the Olumi tab names the engine serving this staging session', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({ currentScenarioId: null })
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  })

  afterEach(() => { cleanup(); window.location.hash = '#/canvas' })

  it('at the staging host without ?diag, the dock carries no route label, and the float-out button stays', () => {
    // Precondition: this really is the staging default, the core route (DL 22 Oct), not an unconfigured host.
    expect(window.location.hostname).toBe('staging--olumi.netlify.app')
    expect(resolveAiComparisonMode()).toBe('core-route')
    render(<ConversationProvider><OlumiTabBody onFloatOut={() => {}} /></ConversationProvider>)
    expect(screen.queryByTestId('olumi-ai-comparison-mode')).toBeNull()
    expect(screen.queryByText(/OpenAI core route/)).toBeNull()
    expect(screen.getByTestId('olumi-tab-float-out')).toBeTruthy()
  })

  it('CONTRAST: in a debug view (?diag=1) the panel names the default engine', () => {
    window.location.hash = '#/canvas?diag=1'
    expect(resolveAiComparisonMode()).toBe('core-route')
    render(<ConversationProvider><OlumiTabBody /></ConversationProvider>)
    expect(screen.getByTestId('olumi-ai-comparison-mode').textContent).toBe('AI: OpenAI core route')
  })

  it('the badge names the serving engine on staging; production names only an explicit mode', () => {
    const staging = 'https://staging--olumi.netlify.app/#/canvas'
    expect(aiComparisonBadge(staging)).toBe('OpenAI core route')
    expect(aiComparisonBadge(`${staging}?ai=openai`)).toBe('OpenAI')
    expect(aiComparisonBadge(`${staging}?ai=core.`)).toBe('OpenAI core route')
    expect(aiComparisonBadge(`${staging}?ai=conventional`)).toBe('Conventional')
    expect(aiComparisonBadge('https://6ab7ebeab5d4da00088e9437--olumi.netlify.app/?ai=conventional#/canvas')).toBe('Conventional')
    // Production has no default engine label: an explicit mode there is non-default, so it is named.
    expect(aiComparisonBadge('https://olumi.example.com/#/canvas')).toBeNull()
    expect(aiComparisonBadge('https://olumi.example.com/#/canvas?ai=openai')).toBe('OpenAI')
  })

  it('CONTRAST: the label itself is unchanged (headers and diagnostics still read it)', () => {
    expect(aiComparisonLabel('https://staging--olumi.netlify.app/#/canvas')).toBe('OpenAI core route')
  })
})
