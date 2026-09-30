/**
 * ACCOUNTS — the invite landing's MOUNT, asserted at the route table.
 *
 * Rendering AcceptInvitePage directly proves the component works and says
 * nothing about whether an invited tester can reach it. The property is the
 * route's POSITION: `/accept-invite` must sit with the public routes, ABOVE the
 * `<Route element={<AuthGuard />}>` block — the tester arrives holding a token,
 * not a session. Same shape as collabParticipantRouteIsPublic.spec.tsx.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(process.cwd(), 'src/poc/AppPoC.tsx'), 'utf8')
const page = readFileSync(resolve(process.cwd(), 'src/components/auth/AcceptInvitePage.tsx'), 'utf8')
// Read from SOURCE, not imported: importing the page pulls in lib/supabase, which
// throws without env. The page's exported path and the route must agree.
const ACCEPT_INVITE_PATH = /export const ACCEPT_INVITE_PATH = '([^']+)'/.exec(page)?.[1] ?? '<missing>'

describe('/accept-invite is mounted OUTSIDE AuthGuard', () => {
  it('POSITIVE CONTROL: the anchors exist and a known-public route precedes the guard', () => {
    const guardAt = src.indexOf('<Route element={<AuthGuard />}>')
    const loginAt = src.indexOf('path="/login"')
    expect(guardAt).toBeGreaterThan(-1)
    expect(loginAt).toBeGreaterThan(-1)
    expect(loginAt).toBeLessThan(guardAt)
  })

  it('the route is declared, lazily imports the page, and precedes the guard', () => {
    expect(ACCEPT_INVITE_PATH).toBe('/accept-invite')
    const routeAt = src.indexOf(`path="${ACCEPT_INVITE_PATH}" element={<AcceptInvitePage />}`)
    const guardAt = src.indexOf('<Route element={<AuthGuard />}>')
    expect(routeAt).toBeGreaterThan(-1)
    expect(routeAt).toBeLessThan(guardAt)
    expect(src).toMatch(/import\('\.\.\/components\/auth\/AcceptInvitePage'\)/)
  })
})
