/**
 * COLLAB — the MOUNT PATH itself, asserted.
 *
 * ── WHY THIS TEST EXISTS AND WHY IT READS SOURCE ──────────────────────────
 * This repo has shipped the same defect twice: a component whose tests were all
 * green while the deployed app never mounted it. Rendering the participant page
 * directly would prove the component works and say NOTHING about whether a
 * participant can reach it — and "a participant cannot reach it" is the entire
 * failure mode.
 *
 * The thing that must hold is a RELATIVE ORDERING in the route tree:
 * `/panel/:round_id` sits with the public routes, ABOVE the `<Route
 * element={<AuthGuard />}>` block. A participant holds no Supabase session, so
 * inside the guard they are redirected to /login — silently, on the deployed
 * build, with every other test still passing.
 *
 * So this binds to the route declaration's POSITION, which is the property, and
 * carries a positive control proving the anchors it measures actually exist.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(process.cwd(), 'src/poc/AppPoC.tsx'), 'utf8')

describe('participant panel route is mounted OUTSIDE AuthGuard', () => {
  it('the route exists at all', () => {
    expect(src).toContain('path="/panel/:round_id"')
    expect(src).toContain('ParticipantPacketPage')
  })

  it('POSITIVE CONTROL: the anchors this test measures are present and ordered as expected', () => {
    // Without this, every index below could be -1 and the ordering assertions
    // would pass on nonsense.
    const guardAt = src.indexOf('<Route element={<AuthGuard />}>')
    const publicBriefAt = src.indexOf('path="/brief/:slug"')
    const guardedScenarioAt = src.indexOf('path="/scenario/:id"')
    expect(guardAt).toBeGreaterThan(-1)
    expect(publicBriefAt).toBeGreaterThan(-1)
    expect(guardedScenarioAt).toBeGreaterThan(-1)
    // The known-public route precedes the guard; the known-guarded one follows.
    expect(publicBriefAt).toBeLessThan(guardAt)
    expect(guardedScenarioAt).toBeGreaterThan(guardAt)
  })

  it('/panel/:round_id is declared BEFORE the AuthGuard block — a participant has no session to guard', () => {
    const panelAt = src.indexOf('path="/panel/:round_id"')
    const guardAt = src.indexOf('<Route element={<AuthGuard />}>')
    expect(panelAt).toBeGreaterThan(-1)
    expect(panelAt).toBeLessThan(guardAt)
  })

  it("the OWNER's setup route is INSIDE the guard — minting names real people and pins the owner's model", () => {
    const ownerAt = src.indexOf('path="/scenario/:id/panel"')
    const guardAt = src.indexOf('<Route element={<AuthGuard />}>')
    expect(ownerAt).toBeGreaterThan(-1)
    expect(ownerAt).toBeGreaterThan(guardAt)
  })

  it('the participant page neither IMPORTS nor CALLS the session-bound gates, which are false for every participant by construction', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/ParticipantPacketPage.tsx'), 'utf8')

    // ⚠ Bind to IMPORT and CALL shapes, not to the bare substring: the file's
    // own header explains WHY these gates must not be used, and a substring
    // check would fire on the explanation. (A loose predicate that another
    // object satisfies is the trap this whole suite exists to avoid — here the
    // other object was a comment.)
    for (const symbol of ['isPersistenceActive', 'getSessionIdentity', 'useAuth']) {
      const imported = new RegExp(`import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}`).test(page)
      const called = new RegExp(`\\b${symbol}\\s*\\(`).test(page)
      expect(imported, `${symbol} must not be imported by the participant page`).toBe(false)
      expect(called, `${symbol} must not be called by the participant page`).toBe(false)
    }

    // POSITIVE CONTROL: this detector DOES fire on a symbol the page really
    // imports and calls — so the falses above are findings, not a blind regex.
    expect(/import\s*\{[^}]*\bfetchOpenPacket\b[^}]*\}/.test(page)).toBe(true)
    expect(/\bfetchOpenPacket\s*\(/.test(page)).toBe(true)
  })
})
