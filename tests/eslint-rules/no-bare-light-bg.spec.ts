/**
 * Tests for the ESLint rule brand-tokens/no-bare-light-bg (DS v5 §3.2).
 * Uses the runner-agnostic Linter API. Negative cases = deliberately-bad fixtures
 * (rule must flag); valid cases = positive fixtures (rule must stay silent).
 */
import { Linter } from 'eslint'
import { describe, it, expect } from 'vitest'
import rule from '../../eslint-rules/no-bare-light-bg.js'

const linter = new Linter()
function lint(code: string) {
  return linter.verify(code, {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'brand-tokens': { rules: { 'no-bare-light-bg': rule } } },
    rules: { 'brand-tokens/no-bare-light-bg': 'error' },
  })
}

describe('brand-tokens/no-bare-light-bg', () => {
  it('NEGATIVE fixtures: flags bare bg-*-light on cards/badges/pills', () => {
    expect(lint(`const c = 'bg-info-light'`)).toHaveLength(1)
    expect(lint(`const c = 'p-2 bg-danger-light text-text-body'`)).toHaveLength(1)
    expect(lint('const c = `flex ${x} bg-goal-light`')).toHaveLength(1)
    expect(lint('const j = <div className="bg-warning-light" />')).toHaveLength(1)
  })

  it('POSITIVE fixtures: allows variant-prefixed (panel hover) and outlined forms', () => {
    expect(lint(`const c = 'hover:bg-info-light'`)).toHaveLength(0)
    expect(lint(`const c = 'group-hover:bg-goal-light'`)).toHaveLength(0)
    expect(lint(`const c = 'focus:bg-success-light'`)).toHaveLength(0)
    expect(lint(`const c = 'bg-panel border border-warning/30 text-text-body'`)).toHaveLength(0)
    expect(lint('const c = `${base} hover:bg-success-light`')).toHaveLength(0)
  })

  it('emits the DS v5 §3.2 guidance message', () => {
    const [msg] = lint(`const c = 'bg-info-light'`)
    expect(msg.messageId).toBe('bareLight')
  })
})
