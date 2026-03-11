/**
 * CSS token test for Conversation.module.css
 *
 * Verifies that GraphPatchBlock uses the --goal token (Design System v4 §20.2),
 * not the --warning orange token.
 *
 * Note: CSS variables are not resolved in unit tests (jsdom doesn't parse computed
 * styles). We assert the token string in the source, not a computed colour value.
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
  it('graphPatchBlock uses --goal token for border-top', () => {
    const css = readFileSync(CSS_PATH, 'utf-8')

    // Find the graphPatchBlock rule and check its border-top value
    const blockMatch = css.match(/\.graphPatchBlock\s*\{([^}]+)\}/s)
    expect(blockMatch, 'graphPatchBlock rule must exist').toBeTruthy()

    const ruleBody = blockMatch![1]
    expect(ruleBody).toContain('--goal')
    expect(ruleBody).not.toContain('--warning')
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
