/**
 * Tests for security/no-stringified-payload-logging.
 *
 * Improvement fold (external review 2026-07-14): the rule was only tested by a
 * standalone RuleTester script at `eslint-rules/__tests__/no-payload-logging.spec.js`
 * — a path NO vitest include glob covers, so it never ran in CI and the security
 * rule had no regression protection. Re-homed here using the same runner-agnostic
 * Linter API as `no-raw-influence-fallback.spec.ts` (the location that runs), so a
 * regression in the rule now fails CI.
 *
 * Round 2 (external review): the rule was RENAMED no-payload-logging →
 * no-stringified-payload-logging so the name matches its scope — it targets
 * un-DEV-guarded `JSON.stringify(payload|request|response|body|data)` in
 * `console.*`, and DELIBERATELY does not flag bare object logging
 * (`console.log('x', payload)`) — a false-positive-risk decision left separate.
 * This spec pins the CURRENT behaviour.
 */
import { Linter } from 'eslint'
import { describe, it, expect } from 'vitest'
import rule from '../../eslint-rules/no-stringified-payload-logging.js'

const linter = new Linter()
function lint(code: string) {
  return linter.verify(code, {
    languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
    plugins: { security: { rules: { 'no-stringified-payload-logging': rule } } },
    rules: { 'security/no-stringified-payload-logging': 'error' },
  })
}

describe('security/no-stringified-payload-logging', () => {
  describe('valid — no error', () => {
    it('allows JSON.stringify inside an import.meta.env.DEV guard', () => {
      expect(
        lint(`if (import.meta.env.DEV) { console.log('Request:', JSON.stringify(request)) }`),
      ).toHaveLength(0)
    })

    it('allows JSON.stringify of a non-sensitive variable (config)', () => {
      expect(lint(`console.log('Config:', JSON.stringify(config))`)).toHaveLength(0)
    })

    it('allows logging a payload variable WITHOUT JSON.stringify (current scope)', () => {
      expect(lint(`console.log('Payload received:', payload)`)).toHaveLength(0)
    })

    it('allows JSON.stringify inside a nested DEV guard', () => {
      expect(
        lint(
          `if (import.meta.env.DEV) { if (someCondition) { console.log('Response:', JSON.stringify(response)) } }`,
        ),
      ).toHaveLength(0)
    })
  })

  describe('invalid — flagged', () => {
    it('flags JSON.stringify(request) in console.log without a DEV guard', () => {
      const msgs = lint(`console.log('Request:', JSON.stringify(request))`)
      expect(msgs).toHaveLength(1)
      expect(msgs[0].messageId).toBe('noPayloadLogging')
    })

    it('flags JSON.stringify(response) without a DEV guard', () => {
      const msgs = lint(`console.log('Response:', JSON.stringify(response))`)
      expect(msgs).toHaveLength(1)
      expect(msgs[0].messageId).toBe('noPayloadLogging')
    })

    it('flags console.log(JSON.stringify(payload)) — the fetch body is allowed, the log is not', () => {
      const msgs = lint(
        `fetch('/api', { body: JSON.stringify(payload) }); console.log(JSON.stringify(payload))`,
      )
      expect(msgs).toHaveLength(1)
      expect(msgs[0].messageId).toBe('noPayloadLogging')
    })

    it('flags JSON.stringify inside a non-DEV condition', () => {
      const msgs = lint(
        `if (someOtherCondition) { console.log('Request:', JSON.stringify(request)) }`,
      )
      expect(msgs).toHaveLength(1)
      expect(msgs[0].messageId).toBe('noPayloadLogging')
    })
  })
})
