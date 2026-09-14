/**
 * ⭐⭐ THE CONTAINER GRAMMAR IS DERIVED FROM THE SOURCE, NOT REMEMBERED.
 *
 * `panelSurfaces.ts` unified six container treatments into one. That fix lasts
 * exactly as long as the next author who types `rounded-lg` — which is the
 * hand-maintained-mirror defect (CLAUDE.md trap 12) in the most visible
 * furniture on the surface, and it is how the six treatments accumulated in the
 * first place. Nobody added them on purpose.
 *
 * So this scans the directory and FAILS LOUD when a section hand-writes a
 * container geometry instead of composing one. It cannot be satisfied by
 * updating a list, because there is no list: the allowed strings live in
 * `panelSurfaces.ts` and the scan reads every other file.
 *
 * ⚠ WHAT IT DOES **NOT** CLAIM. It does not claim every box on the surface goes
 * through `surface()` — a scan can see a banned token, never an intent. It
 * claims the narrow, checkable thing: no `analysisNew` source file outside the
 * grammar module spells a container radius or a container padding of its own.
 * A component could still compose a box from utilities this scan does not name.
 * That is a real gap and it is stated rather than papered over.
 *
 * ⚠ AND IT SCANS SOURCE, WHICH MEANS IT CANNOT TELL PROSE FROM A CLASS. The
 * repo already owns this defect twice — the Design System ratchet tripped on a
 * comment that NAMED the banned utility, and this repo's own load guard blocked
 * a file write because the prose contained the word for a test runner. So the
 * scan strips block and line comments before matching, and the positive control
 * below proves the stripper did not simply eat everything.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PANEL_SURFACE, PANEL_INSET, surface, inset, SURFACE_TONE } from '../panelSurfaces'

const ROOT = join(__dirname, '..')
const GRAMMAR_MODULE = 'panelSurfaces.ts'

/** Container geometries that may now be spelled ONLY in the grammar module. */
const BANNED = [
  // The two radii the boxes used to disagree about.
  'rounded-lg',
  // The paddings that went with them.
  'px-3 py-2.5',
  'bg-warning/[0.04]',
]

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      // The specs themselves may quote a banned token to test for it.
      if (name === '__tests__') continue
      sourceFiles(full, acc)
      continue
    }
    if (/\.tsx?$/.test(name) && name !== GRAMMAR_MODULE) acc.push(full)
  }
  return acc
}

describe('THE SCAN CAN SEE A VIOLATION (positive control)', () => {
  /**
   * ⚠ WITHOUT THIS THE WHOLE FILE IS VACUOUS. An absence assertion over a
   * comment-stripped corpus passes identically when the stripper is broken and
   * has eaten the file (CLAUDE.md trap 13). This proves the instrument fires.
   */
  it('finds a banned geometry in code', () => {
    const hit = stripComments('const a = 1\nconst x = "rounded-lg border px-3 py-2.5"\n')
    for (const token of BANNED.slice(0, 2)) expect(hit).toContain(token)
  })

  it('…and does NOT find one that appears only in a comment — the twin', () => {
    const missed = stripComments('/* we used to write rounded-lg here */\n// and px-3 py-2.5 too\n')
    for (const token of BANNED) expect(missed).not.toContain(token)
  })

  it('the corpus it scans is non-empty and includes the sections', () => {
    const files = sourceFiles(ROOT)
    expect(files.length).toBeGreaterThan(10)
    expect(files.some((f) => f.endsWith('sections/ModelHeldUp.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('sections/AtAGlance.tsx'))).toBe(true)
  })
})

describe('no section hand-writes a container geometry', () => {
  it('every banned token appears only in the grammar module', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(ROOT)) {
      const code = stripComments(readFileSync(file, 'utf8'))
      for (const token of BANNED) {
        if (code.includes(token)) offenders.push(`${file.replace(ROOT, '')} → ${token}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('the grammar composes what it promises', () => {
  /**
   * ⚠ DERIVED FROM THE MODULE, NOT RESTATED. Listing the expected strings here
   * would make this a second copy of the thing under test — a guard agreeing
   * with itself (trap 13b). It asserts the STRUCTURE instead: every tone
   * composes onto the shared geometry, and no tone smuggles a geometry of
   * its own.
   */
  it('every tone yields the shared surface geometry plus exactly its own tone', () => {
    for (const tone of Object.keys(SURFACE_TONE) as Array<keyof typeof SURFACE_TONE>) {
      expect(surface(tone)).toBe(`${PANEL_SURFACE} ${SURFACE_TONE[tone]}`)
      expect(inset(tone)).toBe(`${PANEL_INSET} ${SURFACE_TONE[tone]}`)
    }
  })

  it('no tone carries a radius or a padding — those belong to the geometry', () => {
    for (const value of Object.values(SURFACE_TONE)) {
      expect(value).not.toMatch(/\brounded/)
      expect(value).not.toMatch(/\bp[xytblr]?-/)
    }
  })

  it('the inset nests INSIDE the surface — a smaller corner, not the same one', () => {
    // 6px outside, 4px inside. Equal radii read as two boxes that happen to
    // touch; this is the one geometric fact that makes nesting legible.
    expect(PANEL_SURFACE).toContain('rounded-md')
    expect(PANEL_INSET).toContain('rounded ')
    expect(PANEL_INSET).not.toContain('rounded-md')
  })
})
