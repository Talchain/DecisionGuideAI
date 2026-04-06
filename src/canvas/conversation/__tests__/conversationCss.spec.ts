/**
 * CSS token test for Conversation.module.css
 *
 * Verifies that GraphPatchBlock uses the --goal semantic token, not the
 * --warning orange token. After Paul's 7 Apr 2026 conversation panel
 * override (full thin border + dot, see commit notes), the token now
 * appears inside a color-mix() expression on the `border` shorthand
 * rather than `border-top: 3px solid var(--goal)`.
 *
 * Note: CSS variables are not resolved in unit tests (jsdom doesn't parse
 * computed styles). We assert the token string in the source, not a computed
 * colour value.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const CSS_PATH = resolve(__dirname, '../Conversation.module.css')
const INDEX_CSS_PATH = resolve(__dirname, '../../../index.css')
const CHAT_THREAD_PATH = resolve(__dirname, '../zones/ChatThread.tsx')
const OUTPUTS_DOCK_PATH = resolve(__dirname, '../../components/OutputsDock.tsx')
const PRE_ANALYSIS_PANEL_PATH = resolve(__dirname, '../../components/pre-analysis/PreAnalysisPanel.tsx')

describe('Conversation.module.css — GraphPatchBlock border token', () => {
  it('graphPatchBlock uses the --goal semantic token, not --warning', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')

    const blockMatch = css.match(/\.graphPatchBlock\s*\{([^}]+)\}/s)
    expect(blockMatch, 'graphPatchBlock rule must exist').toBeTruthy()

    const ruleBody = blockMatch![1]
    expect(ruleBody).toContain('--goal')
    expect(ruleBody).not.toContain('--warning')
  })

  it('graphPatchBlock uses a full thin border (no top-only 3px accent)', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')

    const blockMatch = css.match(/\.graphPatchBlock\s*\{([^}]+)\}/s)
    expect(blockMatch).toBeTruthy()

    const ruleBody = blockMatch![1]
    // Paul's 7 Apr override: every conversation block uses a full 1px border
    // with the semantic colour at 30% opacity. The dot is the type signal.
    expect(ruleBody).toMatch(/border:\s*1px\s+solid/)
    expect(ruleBody).not.toMatch(/border-top:\s*3px/)
    expect(ruleBody).toContain('color-mix')
  })

  it('graphPatchBlock has a shadow-1 box-shadow (DS v5 §5)', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')
    const blockMatch = css.match(/\.graphPatchBlock\s*\{([^}]+)\}/s)
    const ruleBody = blockMatch![1]
    expect(ruleBody).toMatch(/box-shadow:\s*0\s+1px\s+2px\s+rgba\(38,\s*38,\s*38,\s*0\.06\)/)
  })

  it('graphPatchBlockApplied recolours the full border to success (not a top accent)', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')
    const appliedMatch = css.match(/\.graphPatchBlockApplied\s*\{([^}]+)\}/s)
    expect(appliedMatch).toBeTruthy()
    const ruleBody = appliedMatch![1]
    // After Paul's override, the applied state swaps the full border to success.
    expect(ruleBody).toContain('--success')
    expect(ruleBody).not.toMatch(/border-top-color/)
  })
})

describe('index.css — olumi scrollbar utility', () => {
  it('defines the shared scrollbar class with the expected width and hover tokens', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf-8')

    expect(css).toContain('.olumi-scrollbar')
    expect(css).toContain('width: 4px')
    expect(css).toContain('height: 4px')
    expect(css).toContain('var(--border-default, #EEE6D8)')
    expect(css).toContain('var(--text-light, #908D8D)')
  })

  it('is applied to the AI thread and right-hand panel sources', () => {
    const chatThreadSource = readFileSync(CHAT_THREAD_PATH, 'utf-8')
    const outputsDockSource = readFileSync(OUTPUTS_DOCK_PATH, 'utf-8')
    const preAnalysisPanelSource = readFileSync(PRE_ANALYSIS_PANEL_PATH, 'utf-8')

    expect(chatThreadSource).toContain('chat-thread olumi-scrollbar')
    expect(outputsDockSource).toContain('olumi-scrollbar px-3 py-3 space-y-4 overflow-y-auto')
    expect(outputsDockSource).toContain('olumi-scrollbar overflow-y-auto px-3 py-3 space-y-6')
    expect(preAnalysisPanelSource).toContain('olumi-scrollbar flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4')
  })
})
