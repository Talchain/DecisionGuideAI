/**
 * Node copy is never centrally aligned.
 *
 * ## Why this is a SOURCE SCAN
 *
 * The thing under test is partly a CSS rule and partly the absence of
 * centring tokens in JSX. jsdom applies no stylesheet (`css: false` in the
 * test config), so a render assertion here could not tell you what a user
 * sees — it would be theatre. What this scan CAN do is stop the rule being
 * deleted, detached from the module that loads it, or re-introduced as a
 * class in the node surface, which is the realistic regression. The visual
 * claim is a BROWSER claim and belongs on the deployed build.
 *
 * ## The rule that separates a defect from correct layout
 *
 * Centring a TEXT BLOCK horizontally is the defect. Centring a row's items on
 * the CROSS axis is correct — `items-center` on a `flex-row` is what puts an
 * icon on its label's optical baseline, and there are 46 such uses in this
 * directory that must not be touched. So the axis, not the class name,
 * decides:
 *
 *   - on a `flex-row`: `justify-*` is horizontal (suspect), `items-*` vertical
 *   - on a `flex-col`: THEY SWAP — `items-*` is horizontal (suspect)
 *
 * and centring is correct regardless when the centred content cannot wrap: a
 * single icon, character or numeric token in a box with an explicit small
 * dimension.
 *
 * ## What each assertion covers, and what it does not
 *
 * Statically decidable, so asserted at zero across the whole node surface:
 * `text-center`; `textAlign`; a kebab-case `text-align` set to `center` (the
 * Tailwind v3 arbitrary-property spelling `[text-align:center]`, which
 * contains neither of the first two); the grid shorthands
 * `place-items-center`, `place-content-center` and `justify-items-center`
 * (each sets the INLINE axis, so each centres copy whatever the display — all
 * three have zero uses here today, making those a review event on arrival
 * rather than a claim about existing code); and `flex-col` co-occurring with
 * `items-center`.
 *
 * NOT asserted globally: `justify-center`. Thirteen uses remain and all
 * thirteen are correct — but for TWO different reasons, and an earlier version
 * of this header gave only the first:
 *
 *   - Twelve sit on a flex ROW, where `justify-*` is horizontal, and each
 *     centres a single icon, character or numeric token in a box with an
 *     explicit small dimension (`w-3 h-3`, `w-4 h-4`, `h-4 min-w-[16px]`,
 *     `h-5 w-5`, `h-[22px] w-[22px]`, or an inline `minWidth: 20px`) — the
 *     cannot-wrap case above.
 *   - The thirteenth, `GhostTierNode.tsx:155`, is NOT that. It is a flex
 *     COLUMN, so `justify-*` there is the VERTICAL axis and centres the door's
 *     content block vertically in a box sized for two lines. That same line is
 *     the one this PR changed — `items-center` → `items-start` — because on a
 *     column `items-*` is the horizontal axis. The `justify-center` is
 *     correctly KEPT.
 *
 * Which axis a class controls is the entire rule of this file, so a header
 * describing all thirteen as glyph boxes teaches the opposite of what the
 * guard enforces. THIS BLOCK IS AUTHORITATIVE: its counts are derived from the
 * same blanked sources the tests below read, and any shorter summary elsewhere
 * — the PR body included — defers to it.
 *
 * A static scan cannot separate a row centring a glyph from a row centring
 * copy without parsing each element's full className for a dimension token,
 * and a guard with false positives is one that gets weakened. The two ghost
 * doors — the only flex-centred COPY blocks in the surface — are instead
 * pinned by identity, per file. A new `justify-center` around copy elsewhere
 * in the node surface is a real residual gap in this guard; it is named here
 * rather than papered over.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const NODES_DIR = resolve(__dirname, '..')

/**
 * Blank comment bodies, preserving every byte offset so reported line numbers
 * stay true. BLANKING, not stripping, and it is not tidiness: this file's own
 * prose names every token it forbids, and `GhostTierNode.tsx` explains in a
 * comment why `items-center` was wrong there. Without this, the scan would
 * match the explanations and go red on a clean tree — and, worse, a real
 * `text-center` could be "satisfied" by a comment that mentions it.
 */
function blankComments(src: string): string {
  const out = src.split('')
  let i = 0
  const n = src.length
  let state: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tick' = 'code'
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue }
      if (c === '/' && d === '*') { state = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue }
      if (c === "'") { state = 'sq'; i++; continue }
      if (c === '"') { state = 'dq'; i++; continue }
      if (c === '`') { state = 'tick'; i++; continue }
      i++; continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; i++; continue }
      out[i] = ' '; i++; continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { out[i] = ' '; out[i + 1] = ' '; state = 'code'; i += 2; continue }
      if (c !== '\n') out[i] = ' '
      i++; continue
    }
    if (c === '\\') { i += 2; continue }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tick' && c === '`')) {
      state = 'code'; i++; continue
    }
    i++
  }
  return out.join('')
}

/**
 * DERIVED, never listed. A hand-written file list is the mirror that goes
 * stale the first time a node renderer is added, and the drift reads as green.
 */
function nodeSurfaceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__') continue
      nodeSurfaceFiles(p, acc)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\./.test(entry)) continue
    acc.push(p)
  }
  return acc
}

const FILES = nodeSurfaceFiles(NODES_DIR)
const BLANKED = FILES.map((f) => [f, blankComments(readFileSync(f, 'utf8'))] as const)

function hits(pred: (line: string) => boolean): string[] {
  const found: string[] = []
  for (const [f, src] of BLANKED) {
    src.split('\n').forEach((line, idx) => {
      if (pred(line)) found.push(`${f.slice(NODES_DIR.length + 1)}:${idx + 1}`)
    })
  }
  return found
}

/**
 * A line is the right unit for a single token and the WRONG unit for a
 * CO-OCCURRENCE. `flex-col` and `items-center` can sit in one className that
 * spans lines, and a per-line predicate reads that as clean — so the
 * co-occurrence is asserted over the whole class VALUE as well.
 *
 * The value is read to its END — a quoted string to its closing quote, a
 * braced expression to its BALANCING brace. Balancing rather than a regex is
 * deliberate, because the two forms a regex misses are both live in this
 * surface: a template literal with a nested backtick inside `${…}`
 * (`BaseNode.tsx:614`, where ``[^`]*`` stops early) and a ternary choosing
 * between two templates (`BaseNode.tsx:1124`, which is not the `{`…`}` form).
 * An extractor that silently skipped those two would leave the gap it was
 * written to close open in exactly the largest classNames here.
 *
 * A braced extent includes the surrounding JS, so a ternary holding
 * `flex-col` in one branch and `items-center` in the other would be flagged
 * although only one can apply. That asymmetry is chosen: no such case exists
 * here today, and a false RED is a review while a false GREEN is the defect
 * shipping. The per-line scan is kept alongside, so the two run TOGETHER.
 */
function classValueExtents(src: string): string[] {
  const out: string[] = []
  let i = -1
  while ((i = src.indexOf('className', i + 1)) !== -1) {
    let j = i + 'className'.length
    while (j < src.length && /\s/.test(src[j])) j++
    if (src[j] !== '=') continue
    j++
    while (j < src.length && /\s/.test(src[j])) j++
    const open = src[j]
    if (open === '"' || open === "'") {
      const end = src.indexOf(open, j + 1)
      if (end === -1) continue
      out.push(src.slice(j, end + 1))
      continue
    }
    if (open !== '{') continue
    let depth = 0
    let k = j
    for (; k < src.length; k++) {
      if (src[k] === '{') depth++
      else if (src[k] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    if (k >= src.length) continue
    out.push(src.slice(j, k + 1))
  }
  return out
}

const CLASS_VALUES: { file: string; value: string }[] = []
for (const [f, src] of BLANKED) {
  for (const value of classValueExtents(src)) {
    CLASS_VALUES.push({ file: f.slice(NODES_DIR.length + 1), value })
  }
}

function classHits(pred: (value: string) => boolean): string[] {
  return CLASS_VALUES.filter((c) => pred(c.value)).map((c) => c.file)
}

/**
 * The arbitrary-property spelling. Named once so the assertion and its
 * positive control below test the SAME regex — a control that compiles its own
 * copy proves nothing about the one doing the work. `_` is Tailwind's space
 * escape, and the optional quotes reach `'text-align': 'center'` in a JS style
 * object as well as `[text-align:center]` in a class.
 */
const TEXT_ALIGN_CENTRE = /text-align\b[\s'"]*:[\s'"_]*center/

describe('canvas node surface — copy is never centrally aligned', () => {
  it('the scan is pointed at real files and can SEE the class family (contrast control)', () => {
    // Without this, every assertion below could pass by scanning nothing —
    // an empty sweep is indistinguishable from a clean one. `items-center`
    // and `justify-center` are the same family as the forbidden tokens and
    // are legitimately present, so a zero here means the instrument is blind,
    // not that the tree is clean.
    expect(FILES.length).toBeGreaterThan(30)
    expect(hits((l) => l.includes('className')).length).toBeGreaterThan(100)
    expect(hits((l) => l.includes('items-center')).length).toBeGreaterThan(20)
    expect(hits((l) => l.includes('justify-center')).length).toBeGreaterThan(5)

    // The class-value scan needs its own control for the same reason, plus a
    // PRECONDITION: it exists only to see co-occurrences a per-line scan
    // splits, so if no class value spans lines it is asserting over the same
    // unit as `hits` and the extra coverage is imaginary. Both must hold.
    expect(CLASS_VALUES.length).toBeGreaterThan(200)
    const multiLine = CLASS_VALUES.filter((c) => c.value.includes('\n'))
    expect(multiLine.length).toBeGreaterThan(0)
    // And the two forms a regex-based extractor dropped are specifically
    // reachable — the whole reason this reads to a balancing brace. Bound by
    // FILE identity, so losing either one to a refactor of the extractor goes
    // red rather than quietly shrinking the scan.
    expect(multiLine.some((c) => c.file === 'BaseNode.tsx' && c.value.includes('${'))).toBe(true)
  })

  it('no text-center anywhere in the node surface', () => {
    expect(hits((l) => l.includes('text-center'))).toEqual([])
  })

  it('no textAlign inline style anywhere in the node surface', () => {
    expect(hits((l) => l.includes('textAlign'))).toEqual([])
  })

  it('no kebab-case text-align set to center — the arbitrary-property spelling', () => {
    // `[text-align:center]` is valid Tailwind v3 and contains neither
    // `text-center` nor `textAlign`, so both assertions above are blind to it.
    // Positive control FIRST: the correct answer over the tree is zero, so the
    // tree itself cannot demonstrate this predicate is capable of firing, and
    // an absence asserted by a regex that matches nothing is vacuous.
    expect(TEXT_ALIGN_CENTRE.test('className="[text-align:center]"')).toBe(true)
    expect(TEXT_ALIGN_CENTRE.test("style={{ 'text-align': 'center' }}")).toBe(true)
    expect(TEXT_ALIGN_CENTRE.test('className="text-left"')).toBe(false)
    expect(hits((l) => TEXT_ALIGN_CENTRE.test(l))).toEqual([])
  })

  it('no grid centring shorthand — these set the INLINE axis, so they centre copy', () => {
    // Unlike `justify-*` on a row, whose axis depends on the flex direction,
    // `place-items-*` and `place-content-*` are two-axis shorthands and
    // `justify-items-*` is the inline axis on a grid — all horizontal whatever
    // the display, so no dimension-token exemption applies. Zero uses today.
    expect(
      hits(
        (l) =>
          l.includes('place-items-center') ||
          l.includes('place-content-center') ||
          l.includes('justify-items-center'),
      ),
    ).toEqual([])
  })

  it('no flex-col that also centres its items — on a column that is the HORIZONTAL axis', () => {
    // Asserted over the whole class VALUE, so a className split across lines
    // cannot hide the pair. This is the strictly larger scan.
    expect(classHits((v) => v.includes('flex-col') && v.includes('items-center'))).toEqual([])
    // And per line as well, because the extractor does not reach every form a
    // className can take (ternaries, helper calls). Union coverage, kept.
    expect(hits((l) => l.includes('flex-col') && l.includes('items-center'))).toEqual([])
  })

  it('the ghost tier door does not centre its copy block (flex-col ⇒ items-* is horizontal)', () => {
    // Bound by IDENTITY to the file, not to a value predicate another element
    // could satisfy. This door's label is a full sentence ("What else could
    // you do?") in a box sized for two lines by design, so wrapping is the
    // intended state and centring it is the defect Paul reported.
    const src = blankComments(readFileSync(join(NODES_DIR, 'GhostTierNode.tsx'), 'utf8'))
    expect(src).toContain('flex-col')
    expect(src).not.toContain('items-center')
    expect(src).not.toContain('text-center')
  })

  it('the ghost option door does not centre its copy block (flex-row ⇒ justify-* is horizontal)', () => {
    const src = blankComments(readFileSync(join(NODES_DIR, 'GhostOptionNode.tsx'), 'utf8'))
    // `items-center` is the CROSS axis on this row and is correct — asserting
    // it is still present stops this test being "read" as a ban on the class.
    expect(src).toContain('items-center')
    expect(src).not.toContain('justify-center')
  })
})

describe('canvas node surface — the UA button centring is overridden', () => {
  // The half of this class that no grep for a centring class can find. The UA
  // stylesheet declares `button { text-align: center }` and Tailwind v3
  // Preflight does not reset it, so a text-bearing <button> in a node centres
  // its copy with no class anywhere. An ancestor cannot fix it: a value
  // DECLARED on the element beats an INHERITED one, which is why
  // `BaseNode.tsx`'s `text-left` wrapper reaches spans and divs but not these.
  const cssPath = join(NODES_DIR, 'nodeTextAlign.css')
  const rawCss = readFileSync(cssPath, 'utf8')
  // Blank CSS comments before asserting on declarations. The header explains
  // the mechanism in prose that names `text-align` and both selectors, so an
  // assertion against the raw file could be satisfied entirely by the
  // rationale — a guard agreeing with its own documentation.
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')

  it('declares text-align: left for buttons under BOTH node roots', () => {
    expect(css).toMatch(/\.react-flow__node\s+button/)
    expect(css).toMatch(/\[data-node-popover\]\s+button/)
    expect(css).toMatch(/text-align:\s*left/)
    // The declaration is the only one in the file: nothing else is asserted
    // about this stylesheet, so a second rule arriving is a review event.
    expect(css.match(/text-align:/g) ?? []).toHaveLength(1)
    expect(css).not.toMatch(/text-align:\s*center/)
  })

  it('is loaded by the module every node surface must import', () => {
    // Pairing, not presence. A stylesheet nothing imports is a rule that
    // silently does nothing, and `registry.ts` is the single module both
    // `ReactFlowGraph.tsx` and `MiniCanvas.tsx` take `nodeTypes` from — so a
    // node cannot render without this file being loaded.
    const registry = blankComments(readFileSync(join(NODES_DIR, 'registry.ts'), 'utf8'))
    expect(registry).toMatch(/import\s+['"]\.\/nodeTextAlign\.css['"]/)
  })

  it('is keyed on the attribute NodePopover emits — asserted at EACH of its two sites', () => {
    // The portalled half. With an `anchorRef`, `NodePopover` createPortals to
    // document.body, so that branch's content is NOT a descendant of
    // `.react-flow__node`; `NodeChip` — the shared chip every node type uses —
    // renders both inline and inside the popover. Renaming the attribute on
    // either side must go red rather than go quiet.
    //
    // The component emits the attribute at TWO sites (the portalled branch and
    // the no-anchorRef inline fallback), and they are NOT interchangeable:
    // selector 1 (`.react-flow__node button`) already covers the inline one,
    // so `[data-node-popover]` is the ONLY selector reaching the portalled
    // one. A single whole-file match cannot tell the sites apart — deleting
    // the attribute from the portalled branch alone left this test green while
    // every text-bearing button in the portalled popover re-centred. So each
    // site is now asserted separately, bound to the structural feature that
    // identifies it rather than to a count.
    //
    // ⚠ THE ATTRIBUTE NAME IS DERIVED FROM THE CSS, NOT WRITTEN TWICE, and the
    // match is BOUNDED. The first version of this test hardcoded the name and
    // used a bare substring match; a mutant renaming the emitted attribute to
    // `data-node-popover-renamed` left it GREEN, because the old name is a
    // PREFIX of the new one. A guard that a rename can satisfy by extension is
    // a guard agreeing with itself. The lookahead is what makes it bite.
    const attr = css.match(/\[([a-z-]+)\]\s+button/)?.[1]
    expect(attr).toBe('data-node-popover')
    const popover = blankComments(readFileSync(join(NODES_DIR, 'shared/NodePopover.tsx'), 'utf8'))

    // Split at the CALL, not the import: the import is `{ createPortal }` with
    // no paren, so `createPortal(` names the call alone. Asserting it occurs
    // exactly once pins the split's own precondition — with two calls, or
    // none, the halves below would not be the branches this test names.
    const CALL = 'createPortal('
    expect(popover.split(CALL)).toHaveLength(2)
    const inlineHalf = popover.slice(0, popover.indexOf(CALL))
    const portalledHalf = popover.slice(popover.indexOf(CALL))

    const emitted = new RegExp(`${attr}(?![a-zA-Z0-9_-])`)
    expect(inlineHalf).toMatch(emitted) // the no-anchorRef inline fallback
    expect(portalledHalf).toMatch(emitted) // the branch that escapes the node
  })
})
