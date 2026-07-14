/**
 * Tests for security/no-payload-logging.
 *
 * Improvement fold (external review 2026-07-14): the rule was only tested by a
 * standalone RuleTester script at `eslint-rules/__tests__/no-payload-logging.spec.js`
 * — a path NO vitest include glob covers, so it never ran in CI and the security
 * rule had no regression protection. Re-homed here using the same runner-agnostic
 * Linter API as `no-raw-influence-fallback.spec.ts` (the location that runs), so a
 * regression in the rule now fails CI.
 *
 * Scope note (deliberately unchanged): the rule targets un-DEV-guarded
 * `JSON.stringify(payload|request|response|body|data)` in `console.*`. Whether it
 * should ALSO flag bare object logging (`console.log('x', payload)`) is a
 * false-positive-risk judgement call left to a separate decision — this spec pins
 * the CURRENT behaviour, it does not change it.
 */
import { Linter } from 'eslint'
import { describe, it, expect } from 'vitest'
import rule from '../../eslint-rules/no-payload-logging.js'

const linter = new Linter()
function lint(code: string) {
  return linter.verify(code, {
    languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
    plugins: { security: { rules: { 'no-payload-logging': rule } } },
    rules: { 'security/no-payload-logging': 'error' },
  })
}

describe('security/no-payload-logging', () => {
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
