/**
 * CSS token test for Conversation.module.css
 *
 * Verifies that GraphPatchBlock uses the --goal token (Design System v3 §19.2),
 * not the --warning orange token.
 *
 * Note: CSS variables are not resolved in unit tests (jsdom doesn't parse computed
 * styles). We assert the token string in the source, not a computed colour value.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const CSS_PATH = resolve(__dirname, '../Conversation.module.css')

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
