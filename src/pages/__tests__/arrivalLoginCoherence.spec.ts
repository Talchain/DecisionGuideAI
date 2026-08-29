/**
 * The arrival screen and the login page may not contradict each other.
 *
 * THE DEFECT, witnessed 29 Aug 2026 on the pinned immutable deploy
 * `6a931247c9b93500080a958b--olumi.netlify.app` (commit `64f2cdef`, asserted
 * from inside the page), one click apart:
 *
 *   arrival  →  "Sign up to keep your models across devices."
 *   /login   →  "This is an invite-only pilot."
 *
 * The product invited a sign-up and then told the user it was invite-only. The
 * line sat between the value proposition and the two buttons — exactly where a
 * first-time reader looks for what to do next — and NEITHER button said sign up.
 * It is the first screen every tester sees, and it failed at the first decision
 * point in the product.
 *
 * ⭐ WHY THIS IS A DERIVED GUARD AND NOT TWO STRING PINS. A pin on the arrival
 * copy alone leaves the contradiction reachable from the other side: someone
 * softens the login footer and the pair is inconsistent again with the suite
 * green. So the assertion is grounded in the PRODUCT, not in taste — the ban on
 * a sign-up invitation is derived from the ROUTE TABLE. Add a real `/signup`
 * route and this guard stops banning the invitation, by construction. Remove
 * the route and restore the copy, and it fails.
 *
 * ⚠ WHAT IT CANNOT SEE, stated rather than implied:
 *  - copy assembled at runtime, or served from CEE;
 *  - an invitation phrased in words the pattern does not anticipate. The
 *    pattern is a PROXY for "invites the user to create an account", not a
 *    proof. Widen it when a new phrasing appears; a pass is not certainty.
 *  - whether account creation is possible at the AUTH PROVIDER. It is —
 *    `LoginPage`'s header records `disable_signup:false` at the API. This guard
 *    is about what the PRODUCT offers a user, and the product offers no route.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Reuse the comment stripper rather than writing a second one: a file must be
// able to EXPLAIN the banned invitation (this one does, at length) without
// tripping the sweep. Two copies of one function is the mirror this estate pays
// for; `guestStorageClaims` owns it.
import { stripComments } from '../../test/guestStorageClaims'

const ROOT = process.cwd()
const ARRIVAL = join(ROOT, 'src/pages/ScenarioListPage.tsx')
const LOGIN = join(ROOT, 'src/components/auth/LoginPage.tsx')
const ROUTES = join(ROOT, 'src/poc/AppPoC.tsx')

const read = (p: string) => readFileSync(p, 'utf8')

/** Every `path=` declared in the app's one route table. */
function declaredRoutes(): string[] {
  const src = read(ROUTES)
  return [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
}

/** Shapes that invite the user to create an account. */
const SIGNUP_INVITATION = /sign[\s-]?up|create an account|register/i

/** Route shapes that would MAKE such an invitation honest. */
const SIGNUP_ROUTE = /^\/(sign[\s-]?up|register|join)$/i

describe('arrival screen and login page tell one story', () => {
  it('the probe can see the route table (positive control)', () => {
    // Asserted first: every claim below is vacuous against an empty parse, and
    // an empty parse looks exactly like a route table with nothing in it.
    const routes = declaredRoutes()
    expect(routes.length, 'no routes parsed — the guard is blind').toBeGreaterThan(8)
    expect(routes).toContain('/login')
    expect(routes).toContain('/canvas')
  })

  it('the probe can still say NO (fabricated contrast)', () => {
    expect(declaredRoutes()).not.toContain('/zzq-fabricated-route')
  })

  it('there is no self-serve sign-up route', () => {
    // The premise the copy ban rests on. If this ever fails, do not delete the
    // test — lift the ban below, because the invitation has become true.
    expect(declaredRoutes().filter((r) => SIGNUP_ROUTE.test(r))).toEqual([])
  })

  it('the login page states the pilot is invite-only', () => {
    expect(stripComments(read(LOGIN))).toContain('This is an invite-only pilot.')
  })

  it('the arrival screen does not invite a sign-up the product cannot honour', () => {
    const hit = SIGNUP_INVITATION.exec(stripComments(read(ARRIVAL)))
    expect(
      hit?.[0] ?? null,
      hit
        ? `ScenarioListPage invites "${hit[0]}", but the route table has no sign-up route and `
          + 'LoginPage says the pilot is invite-only. Either add the route or drop the invitation.'
        : '',
    ).toBeNull()
  })

  it('the detector fires on the sentence that shipped (positive control)', () => {
    // The exact copy withdrawn on 29 Aug. If this stops matching, the assertion
    // above is testing nothing — the failure mode that makes a ban list a
    // decoration rather than a guard.
    expect(SIGNUP_INVITATION.test('Sign up to keep your models across devices.')).toBe(true)
    expect(SIGNUP_INVITATION.test('Create an account to keep your models.')).toBe(true)
    // …and does NOT fire on the honest replacement, or the ban has grown so
    // broad that it forbids saying the true thing. Over-blocking reads as safe
    // and is how a guard quietly starts costing the product its voice.
    expect(
      SIGNUP_INVITATION.test(
        'This is an invite-only pilot. Sign in if you have an account.',
      ),
      'the honest sentence must survive the ban',
    ).toBe(false)
  })
})
