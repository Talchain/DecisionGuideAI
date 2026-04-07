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

/**
 * Paul's 7 Apr 2026 conversation panel override: every conversation block
 * uses a full 1px border at 30% via color-mix, a 20px radius, and shadow-1.
 * This parameterised test protects the contract across all block types so
 * a future regression on any single block is caught.
 */
describe('Conversation.module.css — all conversation blocks share the full-border contract', () => {
  const CONVERSATION_BLOCKS: Array<{ className: string; token: string }> = [
    { className: 'reviewCardInfo',    token: '--info' },
    { className: 'reviewCardAlert',   token: '--danger' },
    { className: 'factBlock',         token: '--success' },
    { className: 'graphPatchBlock',   token: '--goal' },
    { className: 'framingBlock',      token: '--info' },
    { className: 'briefBlock',        token: '--success' },
    { className: 'evidenceBlock',     token: '--info' },
    { className: 'comparisonBlock',   token: '--info' },
    { className: 'premortemBlock',    token: '--warning' },
    { className: 'flipAnalysisBlock', token: '--danger' },
    { className: 'proposalBlock',     token: '--goal' },
    { className: 'exerciseBlock',     token: '--info' },
  ]

  const css = readFileSync(CSS_PATH, 'utf-8')

  it.each(CONVERSATION_BLOCKS)(
    '$className has a full 1px border using $token wrapped in color-mix — no top-only 3px accent',
    ({ className, token }) => {
      // Non-greedy match up to the first closing brace so we don't accidentally
      // swallow the next rule body (covers single-rule bodies without nested braces).
      const ruleRegex = new RegExp(`\\.${className}\\s*\\{([^}]+)\\}`, 's')
      const match = css.match(ruleRegex)
      expect(match, `${className} rule must exist`).toBeTruthy()

      const ruleBody = match![1]
      // Full 1px border using color-mix() — the new conversation override
      expect(ruleBody).toMatch(/border:\s*1px\s+solid\s+color-mix\(/)
      expect(ruleBody).toContain(token)
      // Old top-3px accent must not sneak back in
      expect(ruleBody).not.toMatch(/border-top:\s*3px/)
      expect(ruleBody).not.toMatch(/border-left:\s*3px\s+solid\s+var\(--(info|danger|goal|success|warning)/)
    },
  )

  it.each(CONVERSATION_BLOCKS)(
    '$className has DS v5 §5 shadow-1 and §6.2 20px radius',
    ({ className }) => {
      const ruleRegex = new RegExp(`\\.${className}\\s*\\{([^}]+)\\}`, 's')
      const ruleBody = css.match(ruleRegex)![1]
      expect(ruleBody).toMatch(/box-shadow:\s*0\s+1px\s+2px\s+rgba\(38,\s*38,\s*38,\s*0\.06\)/)
      expect(ruleBody).toMatch(/border-radius:\s*20px/)
    },
  )

  it('no conversation block class contains a 3px coloured one-sided border', () => {
    // Guard against any *new* block class being added with the old top-accent pattern.
    // Panel-border dividers (--border-default) are allowed; semantic colour tokens are not.
    const illegalMatches = css.match(
      /border-(top|left|right|bottom):\s*3px\s+solid\s+var\(--(info|danger|success|goal|warning)/g,
    )
    expect(illegalMatches).toBeNull()
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
