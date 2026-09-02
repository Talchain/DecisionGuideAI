/**
 * POSITIONS CANNOT CREEP BACK IN BESIDE THE BAND.
 *
 * The defect this lane closed was not any one notice being in the wrong place.
 * It was that NOTHING OWNED CANVAS OVERLAY SPACE: every position was a
 * hand-written class string, four components claimed top-centre independently,
 * and the only collision reasoning in the codebase was prose. Prose does not
 * fail when someone adds a fifth.
 *
 * So this guard is derived from the BYTES of the migrated components, and it
 * asserts two things a reviewer cannot reliably check by reading:
 *
 *   1. the claimant ids in the code and the ids in `OVERLAY_PRIORITY` are the
 *      SAME SET, in both directions — a claimant missing from the table would
 *      never win a cell, and a table entry with no claimant is a dead rule that
 *      reads as governing something;
 *   2. none of the migrated files still contains a self-positioning string.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE SCANNING, AND THAT IS LOAD-BEARING RATHER THAN
 * TIDINESS. The migrated components now EXPLAIN the positions they used to
 * carry — `ModelExtentNotice` says in as many words that `left-1/2` centred it
 * on the window and put the button under the Olumi pill. A scan over raw bytes
 * would fire on the explanation of the defect and force the next author to
 * delete the reason the code is the way it is. A guard that punishes
 * documentation gets the documentation removed, not the defect.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OVERLAY_PRIORITY, OVERLAY_BAND_PILL_GUTTER, type OverlayCell } from '../components/CanvasOverlayBand'
import { CANVAS_LOD_NOTICE_TESTID } from '../components/CanvasLodNotice'
import { FIRST_MODEL_NOTICE_TESTID } from '../components/FirstModelNotice'

const COMPONENTS = resolve(__dirname, '../components')

/** Every file migrated onto the band. */
const MIGRATED = [
  'CanvasLodNotice.tsx',
  'ModelExtentNotice.tsx',
  'FirstModelNotice.tsx',
  'AssistantFocusChip.tsx',
  'FocusModeChip.tsx',
  'StarterProvenanceBanner.tsx',
  'LensInfoPanel.tsx',
] as const

function readComponent(file: string): string {
  return readFileSync(resolve(COMPONENTS, file), 'utf8')
}

/**
 * Remove block and line comments. Deliberately simple: these files contain no
 * string literal carrying `/*` or `//`, and the positive control below proves
 * the stripper leaves real code behind rather than emptying the file — which is
 * the failure mode that would make every assertion here vacuous.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Identifier tokens used as claimant ids, resolved from the modules that export them. */
const TOKEN_TO_ID: Record<string, string> = {
  CANVAS_LOD_NOTICE_TESTID,
  FIRST_MODEL_NOTICE_TESTID,
}

interface FoundClaim {
  file: string
  cell: string
  id: string
}

/** Every `useOverlayCell('<cell>', <id>, …)` call across the migrated files. */
function findClaims(): FoundClaim[] {
  const out: FoundClaim[] = []
  for (const file of MIGRATED) {
    const code = stripComments(readComponent(file))
    for (const m of code.matchAll(/useOverlayCell\(\s*'([^']+)'\s*,\s*([^,)]+)/g)) {
      const cell = m[1]
      const rawId = m[2].trim()
      const literal = /^'([^']*)'$/.exec(rawId)
      const id = literal ? literal[1] : TOKEN_TO_ID[rawId]
      expect(
        id,
        `${file}: useOverlayCell's id \`${rawId}\` is neither a string literal nor a token this ` +
          `guard can resolve. Export the constant and add it to TOKEN_TO_ID — an unresolvable id ` +
          `would silently drop out of the set comparison below.`,
      ).toBeTypeOf('string')
      out.push({ file, cell, id })
    }
  }
  return out
}

/**
 * The position strings the band exists to abolish, each with the component that
 * used to carry it — named so a failure says what regressed, not just that
 * something did.
 */
const BANNED_POSITIONS: ReadonlyArray<{ pattern: RegExp; was: string }> = [
  { pattern: /\btop-3\b/, was: 'CanvasLodNotice / ServerGraphRetryNotice top-centre' },
  { pattern: /\bbottom-4\b/, was: 'ModelExtentNotice bottom-centre' },
  { pattern: /\bleft-1\/2\b/, was: 'every top-centre and bottom-centre claimant' },
  { pattern: /-translate-x-1\/2/, was: 'the centring half of those same strings' },
  { pattern: /\btop-\[72px\]/, was: 'StarterProvenanceBanner, over the decision node' },
  { pattern: /\bz-\[250\]/, was: 'StarterProvenanceBanner z-index' },
  { pattern: /\bz-\[90\]/, was: 'ModelExtentNotice z-index' },
  { pattern: /\bz-\[100\]/, was: 'the vacated top-centre chip column' },
]

describe('overlay ownership — derived from the migrated components’ bytes', () => {
  it('POSITIVE CONTROL: the scan reads real code and finds claims', () => {
    // Trap 13: an extractor that matched nothing would agree with every
    // assertion below, and two empty sets compare equal. Prove it can SEE.
    const claims = findClaims()
    expect(claims.length, 'the scan found no useOverlayCell calls — every assertion below is vacuous').toBeGreaterThan(0)
    for (const file of MIGRATED) {
      const stripped = stripComments(readComponent(file))
      expect(stripped.length, `${file}: comment-stripping emptied the file`).toBeGreaterThan(200)
      expect(stripped, `${file}: stripping removed the code, not just the comments`).toContain('useOverlayCell')
    }
  })

  it('every claimant id in the code is declared in OVERLAY_PRIORITY, in its own cell', () => {
    for (const { file, cell, id } of findClaims()) {
      const declared = OVERLAY_PRIORITY[cell as OverlayCell]
      expect(declared, `${file}: useOverlayCell names an unknown cell '${cell}'`).toBeDefined()
      expect(
        declared.includes(id),
        `${file}: '${id}' claims '${cell}' but is not listed in OVERLAY_PRIORITY['${cell}'], so it ` +
          `can never win the cell and would silently never render.`,
      ).toBe(true)
    }
  })

  it('every id in OVERLAY_PRIORITY has a claimant in the code — no dead rules', () => {
    // The other direction. A table entry with no call site reads as governing
    // something and governs nothing, which is precisely the hand-maintained
    // mirror this file exists to prevent.
    const claimed = new Set(findClaims().map((c) => c.id))
    for (const cell of Object.keys(OVERLAY_PRIORITY) as OverlayCell[]) {
      for (const id of OVERLAY_PRIORITY[cell]) {
        expect(
          claimed.has(id),
          `OVERLAY_PRIORITY['${cell}'] lists '${id}', but no migrated component calls ` +
            `useOverlayCell with it. Either wire it up or remove the entry.`,
        ).toBe(true)
      }
    }
  })

  it('no migrated component positions itself any more', () => {
    for (const file of MIGRATED) {
      const code = stripComments(readComponent(file))
      for (const { pattern, was } of BANNED_POSITIONS) {
        expect(
          pattern.test(code),
          `${file} contains \`${pattern.source}\` (${was}). Overlay position is the band's to ` +
            `decide — a component that positions itself is outside the one-slot-one-occupant rule ` +
            `and can be drawn over a node again.`,
        ).toBe(false)
      }
    }
  })

  it('CONTRAST CONTROL: the position scan discriminates — a re-introduced string is detected', () => {
    // Proves the assertion above is sensitive to what it claims to measure,
    // without mutating a real file. Without this, a regex that could never
    // match would report "no positions" forever.
    const poisoned = stripComments(readComponent('ModelExtentNotice.tsx')).replace(
      'data-testid="model-extent-notice"',
      'className="absolute bottom-4 left-1/2 -translate-x-1/2"\n      data-testid="model-extent-notice"',
    )
    const hits = BANNED_POSITIONS.filter(({ pattern }) => pattern.test(poisoned))
    expect(hits.length, 'the scan could not see a re-introduced position string').toBeGreaterThanOrEqual(3)
  })

  it('the band’s pill gutter still clears the pill it was derived from', () => {
    // ⚠ NOT A MIRROR — DERIVED. `OVERLAY_BAND_PILL_GUTTER` reserves the corner
    // the minimised Olumi pill docks into, and that pill's width lives in
    // another component as a private constant. Restating 84 here would be the
    // hand-maintained mirror this estate keeps paying for, so the guard reads
    // `FloatingOlumiPanel`'s bytes instead: if the pill grows past what the
    // band reserves, the "Show whole model" overlap the founder reported comes
    // straight back, at the same address.
    const panel = readFileSync(resolve(COMPONENTS, 'FloatingOlumiPanel.tsx'), 'utf8')
    const w = /const PILL_W = (\d+)/.exec(panel)
    const margin = /const DEFAULT_MARGIN = (\d+)/.exec(panel)
    expect(w, 'PILL_W not found in FloatingOlumiPanel.tsx — this guard has gone blind').not.toBeNull()
    expect(margin, 'DEFAULT_MARGIN not found in FloatingOlumiPanel.tsx').not.toBeNull()

    const needed = Number(w![1]) + 2 * Number(margin![1])
    expect(needed).toBeGreaterThan(0)
    expect(
      OVERLAY_BAND_PILL_GUTTER,
      `the pill now needs ${needed}px of corner (PILL_W ${w![1]} + 2x DEFAULT_MARGIN ${margin![1]}), ` +
        `but the band reserves only ${OVERLAY_BAND_PILL_GUTTER}px. A bottom-centre occupant can now ` +
        `be overlapped by the pill again.`,
    ).toBeGreaterThanOrEqual(needed)
  })

  it('the vacated top-centre column is not rebuilt in ReactFlowGraph', () => {
    // The column held three of the four top-centre claimants. Its own comment
    // explained that FirstModelNotice lived there "rather than at bottom-centre
    // because ModelExtentNotice owns that position" — which is how it ended up
    // across the decision node's title.
    const graph = stripComments(readFileSync(resolve(__dirname, '../ReactFlowGraph.tsx'), 'utf8'))
    expect(
      /absolute\s+z-\[100\]\s+left-1\/2/.test(graph),
      'the top-centre chip column has been rebuilt in ReactFlowGraph',
    ).toBe(false)
    expect(
      graph.includes('<CanvasOverlayBand />'),
      'the band element is no longer mounted — every claimant would fall back to rendering inline',
    ).toBe(true)
  })
})
