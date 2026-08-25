/**
 * Repo-wide sweep: no user-facing source may claim where a guest's work lives.
 *
 * The scope is DISCOVERED by globbing tracked source, not handed in as a list of
 * surfaces — see `../guestStorageClaims` for why (its twin survived a pin that
 * was scoped to one component).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  GUEST_STORAGE_CLAIM_PATTERNS,
  GUEST_STORAGE_CLAIM_ADJUDICATED,
  GUEST_STORAGE_CLAIMS_LICENSED,
  stripComments,
  findGuestStorageClaim,
} from '../guestStorageClaims'

function trackedSourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', 'src/**/*.ts', 'src/**/*.tsx'], { encoding: 'utf8' })
  return out.split('\n')
    .filter(Boolean)
    .filter(p => !/__tests__|__mocks__|\.spec\.|\.test\.|\/test\//.test(p))
}

describe('guest storage claims', () => {
  const files = trackedSourceFiles()

  it('the sweep can actually see source (positive control)', () => {
    // Asserted FIRST: every assertion below is vacuous if the glob is empty, and
    // an empty glob looks exactly like a clean tree.
    expect(files.length, 'git ls-files returned nothing — the sweep is blind').toBeGreaterThan(500)
    expect(files.some(f => f.endsWith('src/pages/ScenarioListPage.tsx'))).toBe(true)
  })

  it('the detector fires on the sentence that shipped (positive control)', () => {
    // The exact copy removed in #841, and its twin. If these stop matching, the
    // sweep below is testing nothing.
    expect(findGuestStorageClaim('Without an account, your work stays only in this browser.')).toBeTruthy()
    expect(findGuestStorageClaim('Save it to keep working on it — otherwise it stays only in this browser.')).toBeTruthy()
    // ⚠ WAS: `findGuestStorageClaim('Sign in to create a saved workspace.')` must be
    // NULL — written when that was this surface's copy and believed harmless. The
    // settled mechanism makes it FALSE (the work is already saved), so the sentence
    // moved from control to banned. Inverted rather than deleted, so the record shows
    // that this file once blessed it.
    expect(findGuestStorageClaim('Sign in to create a saved workspace.')).toBeTruthy()
    expect(findGuestStorageClaim('Sign up to keep your models across devices.')).toBeNull()
  })

  it('comments may explain the banned claim without tripping the sweep', () => {
    const withComment = '// "only in this browser" is false; a guest graph exists server-side\nconst a = 1'
    expect(findGuestStorageClaim(withComment)).toBeTruthy()
    expect(findGuestStorageClaim(stripComments(withComment))).toBeNull()
  })

  it('no user-facing source makes a claim about where a guest\'s work is stored', () => {
    const offenders: string[] = []
    for (const file of files) {
      if (file in GUEST_STORAGE_CLAIM_ADJUDICATED) continue
      const hit = findGuestStorageClaim(stripComments(readFileSync(file, 'utf8')))
      if (hit) offenders.push(`${file} → ${hit}`)
    }
    expect(
      offenders,
      offenders.length === 0 ? '' : `These files claim where a guest's work lives:\n  ${offenders.join('\n  ')}\n`
        + "A guest's graph also exists server-side, so \"only in this browser\" and its variants are false. "
        + 'State the action, not the storage.',
    ).toEqual([])
  })

  it('every pattern is distinct and non-trivial', () => {
    const sources = GUEST_STORAGE_CLAIM_PATTERNS.map(p => p.source)
    expect(new Set(sources).size).toBe(sources.length)
    for (const s of sources) expect(s.length).toBeGreaterThan(8)
  })

  /**
   * ⚠ THE ALLOWLIST MUST NOT ROT. An entry that no longer matches is either a
   * fixed file that should leave the list, or a renamed one — either way the
   * list has quietly widened. Asserted in BOTH directions.
   */
  it('every adjudicated path still matches, and still exists', () => {
    for (const [path, reason] of Object.entries(GUEST_STORAGE_CLAIM_ADJUDICATED)) {
      expect(files, `${path} is adjudicated but no longer tracked — remove it`).toContain(path)
      expect(
        findGuestStorageClaim(stripComments(readFileSync(path, 'utf8'))),
        `${path} no longer makes a storage claim — remove it from the adjudication list`,
      ).toBeTruthy()
      expect(reason.length, `${path} needs a real reason`).toBeGreaterThan(80)
    }
  })

  /**
   * ⭐ THE BAN LIST MUST NOT EAT THE TRUTH. A list of forbidden phrasings drifts
   * towards forbidding everything, and over-blocking reads as safe: nothing fires,
   * nothing logs, and a surface that says less looks tidier than one that lies.
   * These are the sentences the settled mechanism LICENSES. If a pattern starts
   * matching one, it has grown too broad and this fails.
   */
  it('licensed sentences are not caught by any ban', () => {
    expect(GUEST_STORAGE_CLAIMS_LICENSED.length).toBeGreaterThan(3)
    for (const sentence of GUEST_STORAGE_CLAIMS_LICENSED) {
      const hit = findGuestStorageClaim(sentence)
      expect(hit, `a licensed sentence was banned: "${sentence}" matched ${hit}`).toBeNull()
    }
  })

  /**
   * The three a reasonable person would write, and one of which I shipped in #841.
   * Each is FALSE under the settled mechanism, and none is obviously so.
   */
  it.each([
    ['already saved — signing in adds an account, not saved-ness', 'Sign in to save your work.'],
    ['the sentence I shipped in #841', 'Sign in to create a saved workspace.'],
    ['clearing data deletes the POINTER, not the model', 'Clearing your browser data deletes your work.'],
    ['locality', 'Your work never leaves your device.'],
    ['exclusivity', 'Only you can see this.'],
  ])('bans a claim that is false under the settled mechanism: %s', (_why, sentence) => {
    expect(findGuestStorageClaim(sentence), `should have been banned: "${sentence}"`).toBeTruthy()
  })
})
