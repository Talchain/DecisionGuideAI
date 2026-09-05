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
 * `text-center`, `textAlign`, and `flex-col` co-occurring with `items-center`.
 *
 * NOT asserted globally: `justify-center` on a flex row. Thirteen uses remain
 * and every one centres a glyph in a fixed small box, which is correct. A
 * static scan cannot separate those from a row that centres copy without
 * parsing each element's full className for a dimension token, and a guard
 * with false positives is one that gets weakened. The two ghost doors — the
 * only flex-centred COPY blocks in the surface — are instead pinned by
 * identity, per file. A new `justify-center` around copy elsewhere in the node
 * surface is a real residual gap in this guard; it is named here rather than
 * papered over.
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
  })

  it('no text-center anywhere in the node surface', () => {
    expect(hits((l) => l.includes('text-center'))).toEqual([])
  })

  it('no textAlign inline style anywhere in the node surface', () => {
    expect(hits((l) => l.includes('textAlign'))).toEqual([])
  })

  it('no flex-col that also centres its items — on a column that is the HORIZONTAL axis', () => {
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

  it('is keyed on the attribute NodePopover actually emits', () => {
    // The portalled half. `NodePopover` createPortals to document.body, so its
    // content is NOT a descendant of `.react-flow__node`; `NodeChip` — the
    // shared chip every node type uses — renders in both places. Renaming the
    // attribute on either side must go red rather than go quiet.
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
    expect(popover).toMatch(new RegExp(`${attr}(?![a-zA-Z0-9_-])`))
    expect(popover).toMatch(/createPortal/)
  })
})
