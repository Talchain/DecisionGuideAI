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
 *
 * ⚠ AMENDED 11 Sep 2026 — THE REMOVAL HAS LANDED, AND THE SHRINKAGE DID RED.
 * All five pinned files were deleted with the v1 Model-tab stack; this spec was
 * never touched by that PR and went red on three assertions, of which TWO were
 * CONTRAST CONTROLS reading a deleted anchor. `V1_PINNED` is re-derived at `{}`
 * — not relaxed — and both controls are RE-POINTED rather than dropped, because
 * a control deleted to restore green is how a guard starts certifying nothing.
 * The paragraph above is kept verbatim: it is the instruction this commit obeyed.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode, stripComments } from '../../../../../tests/helpers/stripSourceComments'

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠⚠ MERGE INSTRUCTION FOR PR #790 — THE RESOLUTION IS A **UNION**, NOT A SIDE
 * ═══════════════════════════════════════════════════════════════════════════
 * #782 (this file, landing FIRST) and #790 widen THE SAME GUARD ON ORTHOGONAL
 * AXES. Taking either side wholesale silently NARROWS the guard and the suite
 * still passes green — which is the only reason this comment exists.
 *
 *   #782 widened the PATTERN AND THE REACH:
 *     · `RAW_ID_TERNARY` — the ternary form (`x ? a : b.id`), alongside the
 *       original `??` form, plus interpolation.
 *     · `tsFiles` is RECURSIVE, with `EXCLUDED_DIR_NAMES`.
 *     · `ModelTabBody.tsx` added as a scan target (the container, which sits
 *       OUTSIDE both directories and renders the tab).
 *
 *   #790 widened the SCOPE:
 *     · `CONTESTED_DIR` — `canvas/components/contested/`, scanned and pinned
 *       empty.
 *
 * ⚠ #782's RECURSION DOES **NOT** SUBSUME #790's DIRECTORY. `CONTESTED_DIR` is
 * `join(HERE, '..', '..', 'contested')` — a SIBLING of `model-tab/`, not a
 * child of it — so the recursive walk of `V1_DIR` never reaches it. Dropping
 * #790's constant because "the walk is recursive now" removes a whole directory
 * from the guard, and nothing goes red.
 *
 * ⚠ AND THE CONVERSE: keeping #790's non-recursive `tsFiles` reverts the
 * recursion, the ternary pattern and the container target in one move. Those
 * three exist because the scan certified this directory at ZERO while a raw
 * wire id was rendering as a row's NAME.
 *
 * SO: keep BOTH `tsFiles` recursion AND `CONTESTED_DIR`; keep BOTH the `??` and
 * ternary patterns; keep BOTH scan targets AND the contested assertions.
 * `V1_PINNED` is BYTE-IDENTICAL in both branches (verified 19 Aug, 665 bytes
 * each) — that half is free, take either.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..')
const V1_DIR = join(HERE, '..')
const V2_DIR = join(HERE, '..', '..', '..', 'model-tab-v2')
/**
 * ⭐⭐ THE CONTAINER — IN SCOPE SINCE 19 Aug 2026, AND ITS ABSENCE WAS THE
 * SCAN'S THIRD BLIND SPOT.
 *
 * `ModelTabBody.tsx` sits at `canvas/components/`, OUTSIDE both directories
 * this file walked, and it renders the Model tab. Measured with these same
 * patterns: SEVEN raw-id fallbacks, of which six reached the user — the goal
 * heading and both clipboard exports, i.e. the precise leak
 * `model-tab/utils.ts:80-83` records as having already "left the estate in what
 * a user pastes into a document".
 *
 * ⚠ AND THE ARGUMENT FOR SCOPING IT IN WAS ALREADY WRITTEN, ONE COMMIT EARLIER,
 * ABOUT SOMETHING ELSE. `buildGoalFitRows` was fixed in place rather than
 * pinned because "`ModelTabBody` owns it, so the leak would have become
 * permanent". That applies verbatim to its OWNER, which outlives the duplicate
 * editor completely — and the argument was not made about the owner.
 */
const CONTAINER = join(HERE, '..', '..', 'ModelTabBody.tsx')

/**
 * The defect CLASS: a nullish-coalescing fallback whose right-hand side is an
 * element's `id`, `source` or `target`.
 *
 * ⚠ Comments are stripped first (`stripComments`) — this file's own header quotes
 * the patterns, and a scan that matched its own documentation would report a leak
 * that does not exist. String and template bodies are kept as CODE: the third
 * pattern's whole target lives inside a template literal.
 */
const RAW_ID_FALLBACK = /\?\?\s*[A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\.(?:id|source|target)\b/g

/**
 * ⭐⭐ THE SECOND SHAPE — ADDED 18 Aug 2026, AND IT IS WHY THIS FILE'S OWN
 * "ZERO" WAS A STATEMENT ABOUT THE INSTRUMENT.
 *
 * `RAW_ID_FALLBACK` matches `??` and only `??`. The canonical editor's node
 * rows and all three repair-queue producers wrote the SAME fallback as a
 * TERNARY:
 *
 *     const label = typeof data?.label === 'string' ? data.label : node.id
 *
 * Four sites, in `model-tab-v2/adapters.ts` — the directory this spec asserts
 * carries ZERO. It passed, every time, because the pattern was written from the
 * shape the author had just fixed rather than from the class. **This file's own
 * header warned about exactly that** ("a pattern narrower than the defect class
 * under-reports and reads as a clean result") one screen above a pattern that
 * was narrower than the defect class. A guard written with the same blind spot
 * as the code it guards agrees with the code.
 *
 * The test is `label`-anchored rather than bare, so an object literal
 * (`{ rowId: n.id, label: … }`) — a colon beside a raw id that is NOT a
 * fallback — does not fire. Both directions are controlled below.
 */
const RAW_ID_TERNARY =
  /\blabel\b[^\n;]{0,120}\?[^\n;]{0,120}:\s*[A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\.(?:id|source|target)\b/g

/**
 * ⭐⭐ THE THIRD SHAPE, AND THE REASON THE OTHER TWO WERE NOT ENOUGH.
 *
 * A raw PROVENANCE token reaching user copy is a different defect from a raw ID
 * fallback, and it hid in the gap between them on TWO independent axes:
 *
 *   · TRANSFORM. `blankNonCode` blanks template-literal BODIES. Measured:
 *     `` `Source: ${obs.source}` `` → the transform leaves
 *     `` `                     ` ``, so the read is erased before any pattern
 *     runs. The sibling guard in `model-tab-v2/__tests__/` documents this exact
 *     failure ("two of these guards shipped structurally incapable of firing")
 *     and switched to `stripComments`. That lesson was not carried across. It is
 *     now: every scan in this file uses `stripComments`.
 *
 *   · PATTERN. Switching the transform alone does NOT catch it — measured, not
 *     assumed. In `x ? `Source: ${obs.source}` : null` the raw read sits in the
 *     ternary's CONSEQUENT, so `RAW_ID_TERNARY` (which anchors on the alternate)
 *     still reads zero. A guard needs both halves right.
 *
 * So a live `Source: cee_inference` sat in the INTERSECTION of both blind spots
 * — in `adapters.ts`, ~80 lines below a commit that fixed the identical
 * expression elsewhere and announced the class closed.
 */
/*
 * ⚠ THE INTERPOLATION MUST *BE* THE RAW READ — not merely contain one.
 *
 * The first cut matched any `${…}` mentioning `.source`, and its own contrast
 * control caught it firing on `` `Source: ${mapSourceToDisplay(obs.source)}` `` —
 * i.e. on the HONEST FIX. A guard that reddens the correct code gets narrowed
 * back to uselessness by the first lane it inconveniences, so it is narrowed
 * here, deliberately, with both directions pinned.
 *
 * A single leading call is allowed (`observedStateOf(data)!.source`) because that
 * is the shape the repair-queue producer actually used; a call WRAPPING the read
 * is not, because that is what humanising looks like.
 */
const RAW_PROVENANCE_IN_COPY =
  /`[^`]*\$\{\s*[A-Za-z_$][\w$]*(?:\([^()]*\))?(?:!?\??\.[\w$]+)*!?\??\.(?:source|provenance)!?\s*\}[^`]*`/g

/**
 * ⚠ RECURSIVE, and `__tests__` excluded — the sibling guard walks this way and
 * this one did not. Both directories are flat today, so there is no live gap;
 * the shape is the defect (a subdirectory added later would be silently out of
 * scope, and the clean result would read exactly like a clean result).
 */
const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__mocks__', '__snapshots__'])

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(e.name)) out.push(...tsFiles(full))
      continue
    }
    if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

/** Both shapes, unioned — the CLASS, not whichever spelling was fixed last. */
function fallbacksIn(file: string): number {
  return countIn(readAnchor(file), file)
}

/**
 * ⚠ THE ANCHOR IS ASSERTED, NOT ASSUMED — 11 Sep 2026, the v1 removal.
 *
 * Anchor reads used to be bare `readFileSync` calls. When the removal deleted
 * `GoalSection.tsx`, the anchors pointing at it threw `ENOENT` out of the
 * standard library: a stack trace that names a syscall and says nothing about
 * the property under test, so the failure read as a broken harness rather than
 * as "your anchor is gone, re-point it". A guard that DIES instead of FAILING
 * tells the next deletion nothing.
 *
 * Both conditions are asserted rather than one, because a file that exists and
 * is EMPTY scans clean — the scan-of-nothing that trap 13 is about — and an
 * emptied anchor would otherwise certify every absence it is used to support.
 * They red on DIFFERENT assertions, so a deleted anchor and a hollowed one are
 * distinguishable from the failure message alone.
 *
 * ⚠ AND IT IS EXTRACTED, NOT INLINED IN `fallbacksIn`, BECAUSE A MUTANT CAUGHT
 * THE FIRST CUT REINTRODUCING THE DEFECT IT WAS FIXING. With the assertion in
 * `fallbacksIn` only, deleting the anchor STILL produced a raw `ENOENT`: the
 * two re-pointed controls need the anchor's TEXT, not just its count, so each
 * carried its own `readFileSync` straight past the new guard. One read site is
 * what makes the fix hold for every caller rather than for the one in hand.
 */
function readAnchor(file: string): string {
  const where = relative(REPO, file)
  expect(
    existsSync(file),
    `scan anchor is missing — it was deleted or moved, re-point it: ${where}`,
  ).toBe(true)
  const src = readFileSync(file, 'utf8')
  expect(
    src.length,
    `scan anchor is empty — a scan of nothing certifies nothing: ${where}`,
  ).toBeGreaterThan(0)
  return src
}

function countIn(src: string, file = 'x.ts'): number {
  // ⚠ `stripComments`, NOT `blankNonCode` — see `RAW_PROVENANCE_IN_COPY`.
  const code = stripComments(src, file)
  return (
    [...code.matchAll(RAW_ID_FALLBACK)].length +
    [...code.matchAll(RAW_ID_TERNARY)].length +
    [...code.matchAll(RAW_PROVENANCE_IN_COPY)].length
  )
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
 * The v1 residual — NOW EMPTY, AND THAT IS THE REMOVAL LANDING (11 Sep 2026).
 *
 * ## What was here, and where it went
 *
 * Five entries, pinned with a reason each: `OptionsSection.tsx` 2,
 * `RisksSection.tsx` 2, `GoalSection.tsx` 1, `FactorsSection.tsx` 3,
 * `RelationshipsSection.tsx` 2. They were pinned rather than fixed because
 * churning code that is about to be deleted buys nothing, and pinned rather
 * than ignored so a NEW leak in the interim could not hide among them.
 *
 * The header above promised “SHRINKAGE is the removal landing, and it must red
 * too, so the follow-up commit has to come here and say so rather than quietly
 * satisfying a `<=`”. **This is that commit saying so.** All five files are
 * deleted by the v1 Model-tab removal; the residual is re-derived at EMPTY, not
 * relaxed. The remaining seventeen files in this directory each scan ZERO.
 *
 * ## ⚠ AN EMPTY PIN IS THE EASIEST KIND TO MAKE VACUOUS
 *
 * `toEqual({})` still REDs on GROWTH — a new leak in any surviving file appears
 * as a key. It does NOT, on its own, red on BLINDNESS: a renamed directory, a
 * broken extension filter or a lost recursion all return `{}` too, and an empty
 * result is indistinguishable from a clean one (trap 13). So the pin carries its
 * own precondition in-test, below: the corpus is asserted non-empty AND asserted
 * to contain two surviving files BY NAME. Growth reds the pin; blindness reds
 * the precondition; they fail on different assertions.
 */
const V1_PINNED: Record<string, number> = {}

/**
 * ⚠ THE CONTAINER'S RESIDUAL — the two `sortedFactors` comparator TIEBREAKS
 * (`ModelTabBody.tsx:515-516`). An id used to order a list never reaches the
 * screen, and resolving it would collapse every unnamed node to one key and make
 * the order arbitrary. Counted anyway rather than excused by a narrower pattern,
 * for the reason this file already applies to `FactorsSection`: a scan that
 * decides which matches "don't count" is a scan that can be argued with.
 *
 * The other five were DISPLAY and are fixed, not pinned.
 */
const CONTAINER_PINNED = 2

describe('the CANONICAL editor never falls back to a wire id', () => {
  it('model-tab-v2/ carries ZERO raw-id fallbacks — derived, nothing to maintain', () => {
    expect(scan(V2_DIR)).toEqual({})
  })

  it('POSITIVE CONTROL: the pattern DOES detect the shape it bans', () => {
    // Without this, a broken regex would certify every directory as clean and
    // the "zero" above would be a statement about the instrument (trap 13).
    // ⚠ THROUGH `countIn` — the SAME pipeline the claims use. The earlier
    // version of this control tested the bare regex against a bare string, which
    // is how the sibling guard once certified a matcher its real scan never got
    // to run. A control must exercise the transform too.
    const sample = 'const l = String(node.data?.label ?? node.id)\nconst f = x?.label ?? edge.source\n'
    expect(countIn(sample)).toBe(2)
  })

  it('CONTRAST CONTROL: it does NOT fire on an honest resolution', () => {
    const honest = "const l = resolveCanvasLabel(edge.source, labels) ?? UNNAMED_ELEMENT_LABEL\n"
    expect(countIn(honest)).toBe(0)
  })

  it('POSITIVE CONTROL: the TERNARY shape — the one that got past this scan — is detected', () => {
    // The exact text that stood in `adapters.ts` at four sites while this file
    // asserted the directory was clean.
    const ternary = "const label = typeof data?.label === 'string' ? data.label : node.id\n"
    expect(countIn(ternary)).toBe(1)
    // …and the queue-producer spelling, which uses a different receiver.
    expect(countIn("label: typeof data?.label === 'string' ? data.label : n.id,\n")).toBe(1)
  })

  it('⭐ POSITIVE CONTROL: a wire token interpolated into user copy IS detected', () => {
    // The exact live expression this scan failed to see, in the file it was
    // pointed at. Proven to read ZERO under the previous transform+pattern pair.
    expect(
      countIn("const b = typeof obs?.source === 'string' ? `Source: ${obs.source}` : null\n"),
    ).toBe(1)
    expect(countIn('const b = `Source: ${data.provenance}`\n')).toBe(1)
    // The repair-queue producer's actual pre-fix spelling — a call, then the read.
    expect(countIn('const b = `Source: ${observedStateOf(data)!.source}`\n')).toBe(1)
  })

  it('⭐ REGRESSION CONTROL: the OLD transform provably could not see it', () => {
    // Pins WHY the third pattern needed a transform change too, so nobody
    // "simplifies" `stripComments` back to `blankNonCode` and silently restores
    // the blind spot. This is a fact about the instrument, asserted.
    const live = "const b = typeof obs?.source === 'string' ? `Source: ${obs.source}` : null\n"
    expect([...blankNonCode(live).matchAll(RAW_PROVENANCE_IN_COPY)]).toHaveLength(0)
    expect([...stripComments(live, 'x.ts').matchAll(RAW_PROVENANCE_IN_COPY)]).toHaveLength(1)
  })

  it('CONTRAST CONTROL: an honest interpolation of a RESOLVED label is clean', () => {
    // The discriminating half: interpolation is not the defect, interpolating a
    // WIRE TOKEN is. A guard that banned all interpolation would be deleted by
    // the first lane it inconvenienced.
    expect(countIn('const b = `Source: ${mapSourceToDisplay(obs.source) ?? ""}`\n')).toBe(0)
    expect(countIn('const t = `${row.label} → ${target.label}`\n')).toBe(0)
  })

  it('CONTRAST CONTROL: an object literal naming a raw id is NOT a fallback', () => {
    // `rowId: n.id` beside a label is legitimate — a queue item MUST carry the
    // element's identity. Without this control the widened pattern would ban
    // the correct code and get narrowed back to uselessness by the first lane
    // it inconvenienced.
    expect(countIn('const item = { rowId: n.id, label: resolved }\n')).toBe(0)
    expect(countIn('return { rowId: edge.id, label: relationshipLabel(d, s, t, m) }\n')).toBe(0)
  })

  it('CONTRAST CONTROL: the honest resolution is clean under BOTH patterns', () => {
    const honest =
      'const label = resolveCanvasLabel(node.id, nodeLabels) ?? UNNAMED_ELEMENT_LABEL\n'
    expect(countIn(honest)).toBe(0)
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
    // ⭐ THE PIN'S OWN PRECONDITION, IN-TEST. `V1_PINNED` is `{}` since the v1
    // removal, and an empty expectation is satisfied by a scan that read
    // NOTHING exactly as well as by a directory that is genuinely clean. These
    // two assertions are what makes the empty pin able to fail: a directory
    // that vanished, a filter that stopped matching `.tsx`, or a recursion
    // that was “simplified” away all red HERE, on a different assertion from
    // the equality below, which reds on growth.
    const corpus = tsFiles(V1_DIR).map(f => relative(REPO, f))
    expect(corpus.length).toBeGreaterThan(5)
    expect(corpus).toContain('src/canvas/components/model-tab/ContestedEdgeCard.tsx')
    expect(corpus).toContain('src/canvas/components/model-tab/ModelHealthSection.tsx')

    expect(scan(V1_DIR)).toEqual(V1_PINNED)
  })

  it('ContestedEdgeCard is NOT in the residual — it outlives the removal', () => {
    // Design §7.4 E keeps this card wholesale, so its two endpoint fallbacks
    // would have become permanent rather than swept up by the delete. They were
    // fixed in place for exactly that reason, and this pins the distinction.
    const card = join(V1_DIR, 'ContestedEdgeCard.tsx')
    const cardKey = relative(REPO, card)
    // Precondition: the walk REACHED this file. Without it the `undefined`
    // below is satisfied by a scan that never looked.
    expect(tsFiles(V1_DIR).map(f => relative(REPO, f))).toContain(cardKey)

    const v1 = scan(V1_DIR)
    expect(v1[cardKey]).toBeUndefined()

    // ⭐ CONTRAST CONTROL, RE-POINTED ONTO THE CARD ITSELF (11 Sep 2026).
    //
    // This read `GoalSection.tsx`, pinned at 1 — a file the v1 removal DELETED,
    // which is why this assertion went red on a PR that never touched this
    // spec. The residual is now EMPTY, so “a file that IS in the residual reads
    // non-zero” has no surviving successor and the control cannot simply be
    // re-pointed at another file in the list: there is no list.
    //
    // It is re-pointed onto THIS CARD'S OWN BYTES instead, which is stronger
    // than what it replaces — the old control discriminated using a DIFFERENT
    // file, so a scan blind to `ContestedEdgeCard.tsx` specifically would have
    // passed both halves. Deleting it, rather than re-pointing it, would leave
    // `toBeUndefined()` asserting nothing at all.
    const cardSrc = readAnchor(card)
    expect(cardSrc.length).toBeGreaterThan(1000)
    expect(countIn(cardSrc, card)).toBe(0)
    // …and the instrument DOES fire on this file's text: one banned endpoint
    // fallback, injected into the real source, is seen. So the zero above is a
    // fact about the card and not a dead scan.
    expect(countIn(`${cardSrc}\nconst l = e?.label ?? edge.source\n`, card)).toBe(1)
  })
})

describe('the CONTAINER — which outlives the removal — leaks nothing to the user', () => {
  it('the file is where this scan thinks it is', () => {
    // Without this, a moved or renamed container makes every claim below vacuous
    // by reading an empty string (trap 13).
    expect(readAnchor(CONTAINER).length).toBeGreaterThan(1000)
  })

  it('matches the pinned residual EXACTLY — and every entry is an ORDERING key', () => {
    // Both directions. Growth is a new leak. SHRINKAGE means the two comparator
    // tiebreaks were changed, which is a decision that must be made here.
    expect(fallbacksIn(CONTAINER)).toBe(CONTAINER_PINNED)
  })

  it('CONTRAST CONTROL: the instrument reads this file, and it discriminates', () => {
    // ⭐ RE-POINTED 11 Sep 2026. This read `GoalSection.tsx`, pinned at 1 — and
    // the v1 removal deleted it, so the helper threw ENOENT here rather than
    // failing an assertion. The anchor moves to `ModelHealthSection.tsx`: the
    // largest file that SURVIVES in this directory, with live importers, so a
    // future deletion of the anchor is a visible product decision rather than a
    // silent one.
    //
    // ⚠ The re-point costs the old control its non-zero half — every surviving
    // file in the duplicate stack scans ZERO now — and “2 above cannot be the
    // output of a scan that silently read nothing” is exactly the claim a pair
    // of zeroes cannot support. The magnitude check is therefore rebuilt on the
    // anchor's OWN bytes: it reads real content, it reads clean, and one banned
    // fallback injected into that same content IS seen.
    const anchor = join(V1_DIR, 'ModelHealthSection.tsx')
    const anchorSrc = readAnchor(anchor)
    expect(anchorSrc.length).toBeGreaterThan(1000)
    expect(fallbacksIn(anchor)).toBe(0)
    expect(countIn(`${anchorSrc}\nconst l = d?.label ?? node.id\n`, anchor)).toBe(1)
    expect(fallbacksIn(join(V2_DIR, 'adapters.ts'))).toBe(0)
  })
})
