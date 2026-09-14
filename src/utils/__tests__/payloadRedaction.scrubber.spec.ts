/**
 * `scrubSecretsInString` — what it removes, and what it deliberately does
 * NOT remove.
 *
 * ⚠ WHY THE SECOND HALF EXISTS. The function's doc comment used to
 * describe its third pattern as `(api[_-]?key|token|secret|password
 * |authorization)[\s=:]+<value>` — i.e. WHITESPACE ALONE would separate a
 * sensitive key from its value. The code requires a `:` or an `=`. A cold
 * review measured the gap: `"My password is hunter2"` passes through
 * verbatim while the documented pattern would have caught it. A comment on
 * a security predicate that is wrong in the PERMISSIVE direction is the
 * worst way for one to be wrong, and nothing in the suite could see it,
 * because every case pointed at the removals.
 *
 * So the non-removals are pinned here as first-class expectations. They
 * are the twin of every positive case: the point is not that they SHOULD
 * leak, it is that the code's actual reach is now recorded and any change
 * to it — widening or narrowing — must be a deliberate, visible edit.
 *
 * These are `toBe` equality assertions on the WHOLE string, not
 * `not.toContain` probes: a `not.toContain` passes when the input never
 * arrived, so it cannot tell "unchanged" from "the test measured nothing".
 */
import { describe, expect, it } from 'vitest'
import { scrubSecretsInString } from '../payloadRedaction'

describe('scrubSecretsInString — removals', () => {
  it('replaces a JWT-shaped three-segment run with [REDACTED:JWT]', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc-DEF_123'
    expect(scrubSecretsInString(`token was ${jwt} ok`)).toBe(
      'token was [REDACTED:JWT] ok',
    )
  })

  it('replaces `bearer <token>` case-insensitively, up to whitespace', () => {
    expect(scrubSecretsInString('sent Bearer sk-live-AAAABBBB now')).toBe(
      'sent bearer [REDACTED] now',
    )
  })

  it('applies both the bearer and key=value branches to an Authorization header', () => {
    // Derived by EXECUTION, not from reading the regexes: the bearer pass
    // runs first and yields `Authorization: bearer [REDACTED] now`, then
    // the key=value pass matches `Authorization: bearer` and rewrites it.
    // The output is therefore doubly redacted, which is safe but is NOT
    // what a reader predicts from the pattern list — pinned so the
    // interaction is recorded rather than rediscovered.
    expect(scrubSecretsInString('Authorization: Bearer sk-live-AAAABBBB now')).toBe(
      'Authorization=[REDACTED] [REDACTED] now',
    )
  })

  it('replaces a sensitive key=value pair', () => {
    expect(scrubSecretsInString('use api_key=sk-live-abc123 today')).toBe(
      'use api_key=[REDACTED] today',
    )
  })

  it('replaces a sensitive key: value pair (colon separator)', () => {
    expect(scrubSecretsInString('password: hunter2')).toBe('password=[REDACTED]')
  })

  it('does not emit one fixed replacement token across the three branches', () => {
    // The doc used to claim "the replacement is a fixed [REDACTED:<reason>]".
    // Only the JWT branch uses that form. Pinned so the claim cannot
    // return.
    const jwt = scrubSecretsInString('eyJa.eyJb.ccc')
    const bearer = scrubSecretsInString('bearer xyz')
    const kv = scrubSecretsInString('secret=xyz')
    expect(jwt).toBe('[REDACTED:JWT]')
    expect(bearer).toBe('bearer [REDACTED]')
    expect(kv).toBe('secret=[REDACTED]')
    expect(new Set([jwt, bearer, kv]).size).toBe(3)
  })
})

describe('scrubSecretsInString — NON-removals, pinned deliberately', () => {
  // The separator is REQUIRED. This is the case the false comment claimed
  // was covered.
  it('leaves a sensitive word in prose with no : or = separator VERBATIM', () => {
    const input = 'My password is hunter2'
    expect(scrubSecretsInString(input)).toBe(input)
  })

  it.each([
    ['a full name', 'The decision owner is Priya Raghavan.'],
    ['an email address', 'Reply to priya.raghavan@northwind-health.co.uk please.'],
    ['a phone number', 'Call me on +44 7700 900412 after four.'],
    ['a monetary figure', 'The programme budget is £4.2m this year.'],
    ['a card-number shape', 'Card 4111 1111 1111 1111 expires soon.'],
  ])('leaves %s VERBATIM — this is a secrets scrubber, not a PII scrubber', (_label, input) => {
    expect(scrubSecretsInString(input)).toBe(input)
  })

  it('leaves ordinary diagnostic prose untouched', () => {
    const input = 'the margin floor is 78% and we are deciding whether to acquire'
    expect(scrubSecretsInString(input)).toBe(input)
  })
})
