/**
 * NO RAW WIRE ID MAY REACH THE USER FROM THE MODEL TAB — a DERIVED scan over
 * both editors' directories (18 Aug 2026, the rehome lane).
 *
 * ## Why a scan and not a render test
 *
 * A render test proves one component is honest about one fixture. The leak class
 * here is `label ?? node.id` — a one-token fallback that reads as defensive
 * programming, is invisible in review, and produced `fac_arr → out_uk_arr_retention`
 * on the CANONICAL editor's relationship rows. There were twelve of them, spread
 * across seven files, and no test anywhere could see the shape.
 *
 * ⚠ THE COMMISSIONED FIGURE WAS EIGHT; THE DERIVED FIGURE IS TWELVE. The brief
 * that ordered this work counted `label ?? <x>.id` and missed four sites of the
 * form `label ?? edge.source` / `?? edge.target` (`ContestedEdgeCard.tsx:173-174`,
 * `RelationshipsSection.tsx:149-150`) — the edge-endpoint variant, which is
 * exactly the one that renders the arrow string a user sees. A pattern narrower
 * than the defect class under-reports and reads as a clean result: this scan
 * matches the CLASS (`?? <expr>.(id|source|target)` beside a `label` read), not
 * the shape someone happened to write down.
 *
 * ## The two directions, and why both
 *
 * `model-tab-v2/` — the canonical editor — must be at ZERO, derived, with no
 * allowance to maintain. `model-tab/` — the duplicate stack, scheduled for
 * removal in the follow-up commit — carries a PINNED residual with a reason per
 * entry, asserted for EXACT EQUALITY IN BOTH DIRECTIONS. Growth is a new leak.
 * SHRINKAGE is the removal landing, and it must red too, so the follow-up commit
 * has to come here and say so rather than quietly satisfying a `<=`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../../../tests/helpers/stripSourceComments'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..')
const V1_DIR = join(HERE, '..')
const V2_DIR = join(HERE, '..', '..', '..', 'model-tab-v2')
/**
 * ⚠ ADDED BY THE REHOME (Milestone B, domain 11) — AND ADDED BECAUSE THE MOVE
 * OPENED A HOLE THIS FILE COULD NOT SEE. `ContestedEdgeCard.tsx` left `V1_DIR`
 * for `components/contested/`, which no scan covered. The test below asserting
 * the card is absent from the v1 residual would have kept passing — trivially,
 * because the FILE was absent — while the card itself became unscanned. A guard
 * that keeps agreeing after its subject leaves its scope is not a guard.
 */
const CONTESTED_DIR = join(HERE, '..', '..', 'contested')

/**
 * The defect CLASS: a nullish-coalescing fallback whose right-hand side is an
 * element's `id`, `source` or `target`.
 *
 * ⚠ Comments and string literals are BLANKED first (`blankNonCode`) — this file's
 * own header quotes the pattern, and a scan that matched its own documentation
 * would report a leak that does not exist.
 */
const RAW_ID_FALLBACK = /\?\?\s*[A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\.(?:id|source|target)\b/g

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && /\.tsx?$/.test(e.name))
    .map(e => join(dir, e.name))
}

function fallbacksIn(file: string): number {
  const code = blankNonCode(readFileSync(file, 'utf8'))
  return [...code.matchAll(RAW_ID_FALLBACK)].length
}

function scan(dir: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of tsFiles(dir)) {
    const n = fallbacksIn(f)
    if (n > 0) out[relative(REPO, f)] = n
  }
  return out
}

/**
 * The v1 residual, PINNED WITH A REASON EACH.
 *
 * Every entry here is a file the removal commit deletes. They are not fixed in
 * place because churning code that is about to be deleted buys nothing and
 * touches files the DS raw-typography ratchet pins by exact count; they are
 * PINNED rather than ignored so a NEW leak in the interim cannot hide among them.
 *
 * ⚠ `FactorsSection.tsx`'s two are SORT COMPARATOR keys (`:690-691`), not display
 * — an id used to order a list never reaches the screen. They are counted here
 * anyway rather than excused by a narrower pattern, because a scan that decides
 * which matches "don't count" is a scan that can be argued with.
 */
const V1_PINNED: Record<string, number> = {
  // 2 — option card label, and the unmapped-coaching list's per-option label.
  'src/canvas/components/model-tab/OptionsSection.tsx': 2,
  // 2 — risk row label, and its trigger-factor list.
  'src/canvas/components/model-tab/RisksSection.tsx': 2,
  // 1 — goal heading label.
  'src/canvas/components/model-tab/GoalSection.tsx': 1,
  // 3 — factor card label (:180) + two sort comparator keys (:690-691).
  'src/canvas/components/model-tab/FactorsSection.tsx': 3,
  // 2 — edge endpoint labels (:149-150), the `from → to` string on screen.
  'src/canvas/components/model-tab/RelationshipsSection.tsx': 2,
}

describe('the CANONICAL editor never falls back to a wire id', () => {
  it('model-tab-v2/ carries ZERO raw-id fallbacks — derived, nothing to maintain', () => {
    expect(scan(V2_DIR)).toEqual({})
  })

  it('POSITIVE CONTROL: the pattern DOES detect the shape it bans', () => {
    // Without this, a broken regex would certify every directory as clean and
    // the "zero" above would be a statement about the instrument (trap 13).
    const sample = 'const l = String(node.data?.label ?? node.id)\nconst f = x?.label ?? edge.source\n'
    expect([...blankNonCode(sample).matchAll(RAW_ID_FALLBACK)]).toHaveLength(2)
  })

  it('CONTRAST CONTROL: it does NOT fire on an honest resolution', () => {
    const honest = "const l = resolveCanvasLabel(edge.source, labels) ?? UNNAMED_ELEMENT_LABEL\n"
    expect([...blankNonCode(honest).matchAll(RAW_ID_FALLBACK)]).toHaveLength(0)
  })

  it('the scan reads real files, not an empty directory', () => {
    // A directory that vanished, or a filter that matched nothing, would make
    // every absence above vacuous. Assert the corpus is non-empty by name.
    const v2 = tsFiles(V2_DIR).map(f => relative(REPO, f))
    expect(v2.length).toBeGreaterThan(5)
    expect(v2).toContain('src/canvas/model-tab-v2/adapters.ts')
  })
})

describe('the DUPLICATE stack’s residual is bounded and named', () => {
  it('matches the pinned set EXACTLY — growth is a leak, shrinkage is the removal', () => {
    expect(scan(V1_DIR)).toEqual(V1_PINNED)
  })

  it('ContestedEdgeCard has LEFT the residual — it was rehomed, not deleted', () => {
    // Design §7.4 E keeps this card wholesale, so its two endpoint fallbacks
    // would have become permanent rather than swept up by the delete. They were
    // fixed in place for exactly that reason. The card has since MOVED to
    // `components/contested/`; the scan of its new home is below, and it is the
    // assertion that now carries the weight.
    const v1 = scan(V1_DIR)
    expect(v1['src/canvas/components/model-tab/ContestedEdgeCard.tsx']).toBeUndefined()
    // Contrast control: a file that IS in the residual reads non-zero, so the
    // absence above is a fact about the directory and not a dead scan.
    expect(v1['src/canvas/components/model-tab/GoalSection.tsx']).toBe(1)
  })
})

describe('the REHOMED adjudication vertical is held to the CANONICAL standard', () => {
  /**
   * `components/contested/` is canonical now — it is hosted by `ModelTabBody`
   * beside the Model Editor and it OUTLIVES the v1 stack's removal. So it gets
   * `model-tab-v2/`'s rule (derived ZERO, nothing to maintain), not `model-tab/`'s
   * pinned-residual allowance. A residual here would become permanent.
   */
  it('contested/ carries ZERO raw-id fallbacks', () => {
    expect(scan(CONTESTED_DIR)).toEqual({})
  })

  it('the scan reads real files there — the zero above is not an empty directory', () => {
    // Trap 13: an absence proven over nothing. Named, because a mis-joined path
    // would silently produce `{}` and certify a directory it never opened.
    const files = tsFiles(CONTESTED_DIR).map(f => relative(REPO, f))
    expect(files).toContain('src/canvas/components/contested/ContestedEdgeCard.tsx')
    expect(files).toContain('src/canvas/components/contested/ContestedEdgeSection.tsx')
  })
})
