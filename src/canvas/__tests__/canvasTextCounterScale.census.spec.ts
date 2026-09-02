/**
 * DERIVED CENSUS — every font size rendered INSIDE the React Flow viewport
 * transform must carry the canvas label counter-scale.
 *
 * WHY THIS EXISTS (browser-measured, Chromium, tip `dd089a50`, 3 shipped
 * starters x 2 laptop viewports, hermetic visual harness).
 * ---------------------------------------------------------------------------
 * `#758` and its geometry follow-up gave canvas label text a counter-scale
 * (`--canvas-label-scale`, see `utils/zoomLegibility.ts`) so a label renders at
 * its DECLARED size instead of `declared x zoom`. Measured at the zoom a
 * post-draft auto-fit actually parks at (0.5000, scale 2.00):
 *
 *   node title   declared 26px -> RENDERED 13.00px   (the counter-scale works)
 *   edge pill    declared 10px -> RENDERED  5.00px   (it does not)
 *
 * The counter-scale reaches text through the three canvas tokens in
 * `typography.ts` and ONLY through them. Sites written as raw utilities or
 * inline styles instead — `text-[10px]`, `style={{ fontSize: 11 }}` — never see
 * it, and render at HALF their declared size on the first view of every model.
 *
 * That is the same defect Design System v5 Sec 2.4 already forbids in prose:
 * "No raw typography utilities... Always use semantic tokens from
 * typography.ts", and "Panel and canvas contexts use 10-12px for information
 * density, always via tokens, never raw classes." The DS rule and the
 * legibility rule are the same rule — a raw utility is precisely the thing the
 * counter-scale cannot reach. This census is that prose, executable.
 *
 * ⭐ WHY THE SCOPE IS DERIVED, AND WHAT #770 GOT WRONG (17-18 Aug 2026).
 * ---------------------------------------------------------------------------
 * The first version of this census stated the rule above — "every font size
 * rendered INSIDE the viewport transform" — and then searched exactly one
 * hand-written directory, `src/canvas/nodes`. **The rule as written and the
 * artefact actually searched were different things**, and a green census reads
 * as covering the rule. It did not: `src/canvas/edges/StyledEdge.tsx` renders
 * four `<EdgeLabelRenderer>` blocks with inline `fontSize`, one of them on the
 * DEFAULT lens, so the direction glyph a new user sees on first view was
 * rendering at 8.0px against a declared 16. The census was green throughout.
 * That is CLAUDE.md trap 20 in a test file: **a probe proves what it was
 * pointed at**, and a hand-listed scope silently decides what it is pointed at.
 *
 * So the scope is no longer written down. It is DERIVED from the only thing
 * that actually decides whether a component renders inside the transform: the
 * React Flow registration sites. `deriveScope()` reads `nodeTypes` out of
 * `nodes/registry.ts` and `edgeTypes` out of `ReactFlowGraph.tsx`, resolves
 * every registered component to a file, and censuses the directories those
 * files live in. Register a node or edge type from a new directory and the
 * scope widens on its own; register nothing and the derivation is a hard ERROR
 * rather than an empty, cheerfully-green walk.
 *
 * ⭐ THE THREE OTHER DOORS INTO THE TRANSFORM, and how each is held shut.
 * ---------------------------------------------------------------------------
 * Derived at the bytes of the installed renderer (`@xyflow/react` 12.10.2,
 * `dist/esm/index.js`, the `GraphViewComponent` return): `<Viewport>` has
 * EXACTLY five children —
 *
 *   1. <EdgeRenderer/>                            -> edgeTypes      (derived scope)
 *   2. <ConnectionLineWrapper/>                   -> connectionLineComponent
 *   3. <div class="react-flow__edgelabel-renderer"/> -> EdgeLabelRenderer portal
 *   4. <NodeRenderer/>                            -> nodeTypes      (derived scope)
 *   5. <div class="react-flow__viewport-portal"/>  -> <ViewportPortal>
 *
 * (3) portals out of an edge component, so it is already inside the derived
 * scope — that is the very defect above. (2) and (5) are the two doors the
 * derivation cannot see, because neither goes through a type registry, so they
 * are asserted ABSENT below with a contrast control. (1) and (4) are derived.
 * There is no sixth door: `<ReactFlow>`'s own `children` render OUTSIDE
 * `<Viewport>`, which is why `<Panel>`, `LodSync` and `CanvasLabelScaleSync`
 * itself are not in scope.
 *
 * ⭐ THE ONE THING THIS CENSUS STILL CANNOT DERIVE — stated, not hidden.
 * ---------------------------------------------------------------------------
 * A component defined OUTSIDE the scope directories but RENDERED from inside
 * one is in the transform, and walking directories cannot see it. Following the
 * whole import graph instead is not the fix: importing a module is not
 * rendering it (a node imports `useShowToastSafe` from `ToastContext.tsx`,
 * whose toast UI renders at app level, far outside any transform), so a
 * module-graph scope OVER-approximates and would demand a counter-scale on text
 * that is not scaled. Measured: 33 `.tsx` in the canvas-bounded import closure
 * against 4 components genuinely rendered across the boundary.
 *
 * So this one is a MIRROR, and it is made fail-loud in both directions rather
 * than pretended away: `FOREIGN_RENDERED` below is DERIVED per run (which
 * imported component identifiers actually appear as JSX inside the scope) and
 * asserted EXACTLY equal to a pinned set. A new cross-boundary render REDs; a
 * removed one REDs too. What it does not do is census those files' own sizes —
 * they are other lanes' surfaces, and their rendered sizes are recorded in the
 * pin so the gap is visible rather than invisible.
 *
 * ⚠ WHAT THIS CENSUS IS AND IS NOT. It proves that every declared size in
 * scope is routed through a counter-scaled token. It CANNOT prove a rendered
 * size — jsdom has no layout and this spec never renders anything (CLAUDE.md
 * trap 3). The rendered-pixel claim is browser-only and lives in
 * `e2e/visual/nodeTextLegibility.visual.spec.ts`. Neither supersedes the
 * other: this one stops a new raw utility being added, that one proves the
 * pixels. Ship both.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../tests/helpers/stripSourceComments'

const ROOT = path.resolve(__dirname, '../../..')
const TYPOGRAPHY = path.join(ROOT, 'src/styles/typography.ts')

/** The two React Flow type registries. Read, never mirrored. */
const NODE_REGISTRY = path.join(ROOT, 'src/canvas/nodes/registry.ts')
const EDGE_REGISTRY = path.join(ROOT, 'src/canvas/ReactFlowGraph.tsx')

/**
 * Rendered OUTSIDE the viewport transform, so the counter-scale must NOT apply
 * — `createPortal` to `document.body` escapes the transformed subtree, and a
 * counter-scaled token there would render at 2x. Excluded BY MECHANISM (the
 * file portals), not by preference; the assertion below re-derives that the
 * exclusion is still earned. Paths are relative to `src/canvas`.
 */
const PORTALLED = ['nodes/shared/NodePopover.tsx']

/**
 * Sizes inside the transform that are NOT yet counter-scaled, pinned EXACTLY.
 *
 * These are an honest, visible gap rather than an invisible one: each declares
 * a size that is not in the DS v5 §2.3 canvas scale (13/11/10), so routing it
 * through a canvas token would silently RESIZE the element rather than merely
 * counter-scale it — a visual-design decision a legibility lane is not entitled
 * to take on its own. They are recorded here so the suite is green for the right
 * reason, and REDs if the set GROWS (a new raw size arrived) or SHRINKS (one
 * was fixed and this pin went stale).
 *
 * Rendered size at the 0.50 auto-fit floor, for whoever picks these up:
 *
 *   ⭐⭐ RESOLVED 1 Sep 2026 AND REMOVED FROM THE SET BELOW —
 *   `nodes/BaseNode.tsx: text-lg` (the low-zoom LOD title boost). It is worth
 *   recording WHY, because the caution stated here was reasonable and the
 *   measurement overturned it. This entry read "18px -> varies with zoom", and
 *   the paragraph above declined to route it through a canvas token on the
 *   grounds that doing so would RESIZE the element (18 -> 12 declared), which
 *   is a visual-design decision a legibility lane may not take alone.
 *
 *   What that reasoning never computed is the SIGN. `text-lg` carries no
 *   counter-scale, so it renders at `18 x zoom`; an ordinary card's title
 *   renders at `12 x labelCounterScale(zoom) x zoom`, which below the
 *   legibility floor is `24 x zoom`. And `lodBoostTitle` is only ever true
 *   BELOW that floor. So the boost was smaller than an ordinary title on 100%
 *   of the cards it touched, 100% of the time — measured in a real browser
 *   (`e2e/geometry/zoomLadder.measure.ts`, five committed starter drafts x two
 *   laptop viewports): 4.67px on the goal and decision cards against 6.23px on
 *   every other card. The two cards this product singles out as always-legible
 *   were the smallest text on the canvas.
 *
 *   The "resize" was therefore the fix, not its cost: the anchor now uses the
 *   same `nodeTitle` token as every other card and takes its emphasis from
 *   weight and colour, which removes a non-scale size AND renders +33.0% to
 *   +33.3% larger (ratio exactly 24/18; the spread is the whole-model fit
 *   shifting <= 0.25% as the anchor cards' rendered height changed).
 *   Pinned by `nodes/__tests__/BaseNode.lodTitleLegibility.spec.tsx`.
 *
 *   ⭐ THE TRANSFERABLE LESSON, because four entries below are held by the same
 *   argument: "routing this through a canvas token would resize it" is a reason
 *   to MEASURE the resize, not a reason to stop. Compute what the site renders
 *   at against what its neighbours render at, in a browser, before concluding
 *   that leaving it alone is the conservative choice. Here it was the opposite.
 *
 *   nodes/EvidenceGapBadge.tsx      7px  -> 3.5px  (also below the DS v5 §2.4
 *                                   10px canvas floor at zoom 1, so it needs a
 *                                   size ruling, not a counter-scale)
 *   nodes/shared/NodeCoachingMarker 12px (typography.caption) -> 6.0px
 *
 *   edges/StyledEdge.tsx            16px -> 8.0px. The polarity glyph (+/−) on
 *                                   the DEFAULT lens, so it is on screen for
 *                                   every new user with a stated direction.
 *                                   16px is FIVE px above the top of the DS
 *                                   §2.3 canvas scale and four above §2.4's
 *                                   10-12px canvas band, so there is no canvas
 *                                   token to route it through: `nodeTitle`
 *                                   would shrink the glyph 16 -> 13 at zoom 1,
 *                                   and minting a fourth canvas size is a
 *                                   design-system change, not a legibility fix.
 *                                   ⭐ NEEDS A SIZE RULING. It is the only one
 *                                   of the five inline edge-label sizes left
 *                                   un-counter-scaled by #771.
 *   edges/EdgeEditPopover.tsx       panelHeader 14px -> 7.0px, panelMeta 11px
 *                                   -> 5.5px. PANEL tokens on a component that
 *                                   renders inside the transform (StyledEdge
 *                                   returns it as a sibling of the edge path).
 *                                   panelMeta is the same 11px as the canvas
 *                                   `nodeLabel`, so that half is a like-for-like
 *                                   swap; panelHeader's 14px is not in the
 *                                   canvas scale and needs the same ruling as
 *                                   the glyph above. ⚠ Separately worth a look:
 *                                   the popover is `position: fixed` with
 *                                   viewport coordinates INSIDE a transformed
 *                                   ancestor, which makes the transform its
 *                                   containing block — a positioning question,
 *                                   not a typography one, and out of scope here.
 */
const KNOWN_FIXED = [
  'nodes/EvidenceGapBadge.tsx:inline-7',
  'nodes/shared/NodeCoachingMarker.tsx:typography.caption',
  'edges/StyledEdge.tsx:inline-16',
  'edges/EdgeEditPopover.tsx:typography.panelHeader',
  'edges/EdgeEditPopover.tsx:typography.panelMeta',
] as const

/**
 * Components defined outside the derived scope but RENDERED from inside it, so
 * they are in the transform and this directory walk cannot see their sizes.
 * Derived per run and asserted EXACTLY — see the header. Declared sizes and
 * what they render at the 0.50 floor, so the gap is costed and not merely named:
 *
 *   canvas/ui/shared/DataBar.tsx        typography.nodeLabel 11px (counter-scaled
 *                                       ✓) AND typography.panelBody 12px -> 6.0px
 *                                       — the numeric readout beside every
 *                                       stability / influence bar on Goal and
 *                                       Factor nodes.
 *   canvas/components/CoachingCard.tsx  typography.nodeLabel 11px — already
 *                                       counter-scaled ✓.
 *   canvas/components/UnknownKindWarning typography.caption 12px -> 6.0px.
 *   components/Tooltip.tsx              raw `text-xs` 12px -> 6.0px. Shared
 *                                       app-wide, so its size is NOT a canvas
 *                                       decision; it renders un-portalled inside
 *                                       BaseNode and OlumiSparkle.
 */
const FOREIGN_RENDERED = [
  'src/canvas/components/CoachingCard.tsx',
  'src/canvas/components/UnknownKindWarning.tsx',
  'src/canvas/ui/shared/DataBar.tsx',
  'src/components/Tooltip.tsx',
] as const

const TW_NAMED = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === '__fixtures__') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(entry) && !/\.spec\.|\.stories\./.test(entry)) {
      out.push(p)
    }
  }
  return out
}

/** Resolve an import specifier the way Vite does, or null for a package import. */
function resolveSpec(fromFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  for (const c of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

/** Every VALUE import in a file, as `binding -> resolved absolute path`. */
function valueImports(file: string, src: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of src.matchAll(/import\s+(?!type\b)([\s\S]{1,400}?)\s+from\s*['"]([^'"]+)['"]/g)) {
    const clause = m[1]
    const resolved = resolveSpec(file, m[2])
    if (!resolved) continue
    for (const braced of clause.matchAll(/\{([\s\S]*?)\}/g)) {
      for (const part of braced[1].split(',')) {
        const t = part.trim()
        if (!t || t.startsWith('type ')) continue
        const name = (t.split(/\s+as\s+/).pop() ?? '').trim()
        if (name) out.set(name, resolved)
      }
    }
    const def = clause.replace(/\{[\s\S]*?\}/g, '').replace(/(^,)|(,$)/g, '').trim().split(',')[0]?.trim()
    if (def && /^[A-Za-z_$][\w$]*$/.test(def)) out.set(def, resolved)
  }
  return out
}

/**
 * DERIVE the in-transform scope from the two React Flow type registries.
 * Returns the directories, plus the entry files, so the assertions below can
 * prove the derivation actually resolved something.
 */
function deriveScope(): { dirs: string[]; entries: string[]; errors: string[] } {
  const errors: string[] = []
  const entries = new Set<string>()

  const collect = (registryFile: string, objectBody: string | undefined, label: string) => {
    if (objectBody === undefined) {
      errors.push(`could not locate the ${label} registry object in ${path.relative(ROOT, registryFile)}`)
      return
    }
    const src = readFileSync(registryFile, 'utf8')
    const imports = valueImports(registryFile, src)
    // Comments are stripped FIRST. `nodeTypes` carries a 6-line block comment
    // between `action:` and `'ghost-option':`, and `\s*` cannot cross it — so
    // the entry immediately after any comment was silently unparsed. Caught by
    // the entry-count control below, which is the whole reason it exists.
    const body = objectBody.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    // `key: Component` / `key: Component as any` / quoted keys
    const idents = new Set<string>()
    for (const m of body.matchAll(/(?:^|,)\s*(?:'[^']+'|"[^"]+"|[\w-]+)\s*:\s*([A-Za-z_$][\w$]*)/g)) idents.add(m[1])
    if (idents.size === 0) errors.push(`${label} registry parsed to zero components — the parser or the registry shape moved`)
    for (const id of idents) {
      const f = imports.get(id)
      if (!f) { errors.push(`${label} registers '${id}' but no value import resolves it`); continue }
      entries.add(f)
    }
  }

  const nodeSrc = readFileSync(NODE_REGISTRY, 'utf8')
  /*
   * ⚠ `rawNodeTypes`, NOT `nodeTypes`. The exported `nodeTypes` is now DERIVED
   * — every renderer is wrapped in the canvas keyboard scope
   * (`nodes/nodeKeyboardScope.tsx`) — so it is no longer an object literal and
   * this parser cannot read it. `rawNodeTypes` is the literal that still names
   * one component per type, which is exactly what this census needs; the
   * derivation between the two is pinned in both directions by
   * `nodes/__tests__/registry.keyboardScope.spec.tsx`.
   *
   * The entry-count control below is what would have caught this silently
   * returning nothing, and it is the reason this is a corrected parser rather
   * than a census that quietly stopped covering the node renderers.
   */
  collect(NODE_REGISTRY, /export const rawNodeTypes[^{]*\{([\s\S]*?)\n\}/.exec(nodeSrc)?.[1], 'nodeTypes')

  const edgeSrc = readFileSync(EDGE_REGISTRY, 'utf8')
  collect(EDGE_REGISTRY, /edgeTypes\s*=\s*useMemo\(\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\)/.exec(edgeSrc)?.[1], 'edgeTypes')

  const dirs = [...new Set([...entries].map(f => path.dirname(f)))].sort()
  return { dirs, entries: [...entries].sort(), errors }
}

interface Hit { file: string; line: number; key: string; mechanism: string; counterScaled: boolean }

/** Parse `typography.ts` for every token → its class string. Derived, never mirrored. */
function readTypographyTokens(): Map<string, string> {
  const src = readFileSync(TYPOGRAPHY, 'utf8')
  const body = src.slice(src.indexOf('export const typography'))
  const tokens = new Map<string, string>()
  for (const m of body.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*'([^']*)'/gm)) tokens.set(m[1], m[2])
  return tokens
}

/** A token carries the counter-scale iff its class string reads the CSS variable. */
function isCounterScaled(classString: string): boolean {
  return classString.includes('var(--canvas-label-scale')
}

const CANVAS = path.join(ROOT, 'src/canvas')

function census() {
  const tokens = readTypographyTokens()
  const { dirs, entries, errors: scopeErrors } = deriveScope()
  const errors = [...scopeErrors]
  const hits: Hit[] = []
  const foreign = new Set<string>()
  const files = dirs.flatMap(d => walk(d))
  const inScope = (f: string) => dirs.some(d => f === d || f.startsWith(d + path.sep))

  for (const file of files) {
    const rel = path.relative(CANVAS, file)
    if (PORTALLED.includes(rel)) continue
    /**
     * ⭐⭐ COMMENTS ARE BLANKED BEFORE THE SCAN, AND THIS GUARD WAS GREEN FOR THE
     * WRONG REASON WITHOUT IT (found 1 Sep 2026, by the change that removed
     * `nodes/BaseNode.tsx:text-lg` from `KNOWN_FIXED`).
     *
     * The size scan below reads the file LINE BY LINE as raw text. `KNOWN_FIXED`
     * is asserted EXACTLY, so its whole value is that it REDs when a pinned site
     * is fixed and the pin goes stale. It did not: the fix removed the last
     * `text-lg` from `BaseNode.tsx`'s CODE and left the string in the doc comment
     * explaining WHY it had gone — and the scan counted the prose. A pin
     * satisfiable by a sentence is not a pin, and the failure mode is silent in
     * both directions: prose can hold a stale pin alive, and prose quoting a
     * banned class can redden CI over text that ships nothing.
     *
     * `deriveScope()` above already strips comments for exactly this reason and
     * says so; the size scan simply never did. Same defect, same file, one
     * function apart — which is why this uses the SHARED stripper rather than a
     * second local regex (CLAUDE.md trap 12: two hand-kept copies of one rule
     * agree on the day they are written).
     *
     * ⛔ `stripComments`, NOT `blankNonCode`. The latter also blanks STRING
     * BODIES, and every class name this census exists to find lives in a string
     * literal — it would return a clean, empty, entirely vacuous census. The
     * stripper keeps string/template/regex literals as code and replaces only
     * comment characters with spaces, newlines intact, so the line numbers this
     * scan reports stay exact.
     */
    const raw = stripComments(readFileSync(file, 'utf8'), file)

    // Cross-boundary renders: an imported component that appears as JSX here is
    // inside the transform even though it lives outside the walked directories.
    for (const [name, target] of valueImports(file, raw)) {
      if (!/^[A-Z]/.test(name)) continue
      if (!new RegExp(`<${name}[\\s/>]`).test(raw)) continue
      if (inScope(target)) continue
      foreign.add(path.relative(ROOT, target))
    }

    raw.split('\n').forEach((text, i) => {
      const line = i + 1
      const push = (key: string, mechanism: string, counterScaled: boolean) =>
        hits.push({ file: rel, line, key: `${rel}:${key}`, mechanism, counterScaled })

      // 1. Arbitrary-value size: text-[10px] or text-[length:calc(...)]
      for (const m of text.matchAll(/text-\[(?:length:)?([^\]]+)\]/g)) {
        const value = m[1]
        if (/^calc\(\s*\d+(?:\.\d+)?px\s*\*\s*var\(--canvas-label-scale/.test(value)) {
          push(`counterscaled-${value.match(/(\d+)px/)?.[1]}`, 'arbitrary', true)
        } else if (/^\d+(?:\.\d+)?px$/.test(value)) {
          push(`text-[${value}]`, 'arbitrary', false)
        } else {
          errors.push(`${rel}:${line} unresolvable arbitrary text size: text-[${value}]`)
        }
      }

      // 2. Named Tailwind size utility
      for (const m of text.matchAll(/\btext-([a-z0-9]+)\b(?!-)/g)) {
        if (TW_NAMED.has(m[1])) push(`text-${m[1]}`, 'tailwind-named', false)
      }

      // 3. typography.X / typo('X') token reference
      for (const m of text.matchAll(/typography\.([a-zA-Z][a-zA-Z0-9]*)|typo\('([a-zA-Z][a-zA-Z0-9]*)'/g)) {
        const name = m[1] ?? m[2]
        const cls = tokens.get(name)
        if (cls === undefined) { errors.push(`${rel}:${line} unknown typography token: ${name}`); continue }
        if (!/text-/.test(cls)) continue // token declares no size
        push(`typography.${name}`, 'token', isCounterScaled(cls))
      }

      // 4. Inline style fontSize. The VALUE is captured first and classified
      // second — a negative lookahead here backtracks over `\s*` and reports a
      // literal as non-literal (caught while writing this census).
      for (const m of text.matchAll(/fontSize:\s*([^,}\n]+)/g)) {
        const rawValue = m[1].trim().replace(/['"]/g, '')
        const px = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(rawValue)
        if (px) push(`inline-${px[1]}`, 'inline', false)
        else errors.push(`${rel}:${line} non-literal inline fontSize: ${rawValue}`)
      }
    })
  }
  return { hits, errors, files: files.length, tokens: tokens.size, dirs, entries, foreign: [...foreign].sort() }
}

describe('canvas text — counter-scale census (DS v5 §2.3/§2.4)', () => {
  const { hits, errors, files, tokens, dirs, entries, foreign } = census()
  const relDirs = dirs.map(d => path.relative(ROOT, d)).sort()

  it('DERIVES its scope from the React Flow type registries, and resolves it', () => {
    expect(errors, errors.join('\n')).toEqual([])
    // Positive control (trap 13): a derivation that resolves nothing satisfies
    // every absence assertion below while measuring nothing at all.
    expect(entries.length, 'no node/edge component resolved from the registries').toBeGreaterThanOrEqual(9)
    expect(relDirs, 'the derived scope is not the two canvas renderer directories')
      .toEqual(['src/canvas/edges', 'src/canvas/nodes'])
    expect(files, 'census walked no files').toBeGreaterThan(10)
    expect(tokens, 'typography.ts parsed no tokens').toBeGreaterThan(20)
    expect(hits.length, 'census found no font sizes at all').toBeGreaterThan(10)
  })

  it('CONTRAST CONTROL: the census can tell counter-scaled from fixed', () => {
    // Absence claims need a positive AND a contrast control. If the resolver
    // silently classified everything one way, the pin below would pass for the
    // wrong reason.
    expect(hits.some(h => h.counterScaled), 'no counter-scaled hit seen — resolver blind').toBe(true)
    expect(hits.some(h => !h.counterScaled), 'no fixed hit seen — resolver blind').toBe(true)
  })

  it('sees BOTH renderer directories, not just the one #770 searched', () => {
    // Binds by identity, not by a count another directory could satisfy: the
    // hand-listed scope was green precisely because nothing pointed it at edges.
    for (const dir of ['nodes', 'edges']) {
      expect(hits.some(h => h.file.startsWith(dir + '/')), `census saw no font size under src/canvas/${dir}`).toBe(true)
    }
  })

  it('the counter-scale reaches text ONLY through the three canvas tokens', () => {
    const scaled = new Set(hits.filter(h => h.counterScaled && h.mechanism === 'token')
      .map(h => h.key.split(':').pop()))
    expect([...scaled].sort()).toEqual(['typography.edgeLabel', 'typography.nodeLabel', 'typography.nodeTitle'])
  })

  it('every font size inside the viewport transform is counter-scaled, except the pinned set', () => {
    const fixed = [...new Set(hits.filter(h => !h.counterScaled).map(h => h.key))].sort()
    // EXACT, both directions: RED if a raw size is added, RED if one of these
    // is fixed and this pin is not updated with it.
    expect(fixed).toEqual([...KNOWN_FIXED].sort())
  })

  it('the portal exclusion is still EARNED, not assumed', () => {
    for (const rel of PORTALLED) {
      const src = readFileSync(path.join(CANVAS, rel), 'utf8')
      expect(src, `${rel} no longer portals — it is inside the transform and must be censused`)
        .toMatch(/createPortal\(/)
    }
  })

  it('the two doors into <Viewport> that no registry declares are still SHUT', () => {
    // `<ViewportPortal>` and a custom `connectionLineComponent` mount straight
    // into the transformed subtree without passing through nodeTypes/edgeTypes,
    // so the derivation above is blind to them. Asserted absent, with a contrast
    // control proving the sweep can see a present symbol at all (trap 13e).
    const sweep = walk(path.join(ROOT, 'src')).map(f => readFileSync(f, 'utf8'))
    const count = (re: RegExp) => sweep.filter(s => re.test(s)).length
    expect(count(/<ViewportPortal[\s/>]/), 'a <ViewportPortal> now renders inside the transform — census it').toBe(0)
    expect(count(/connectionLineComponent\s*=/), 'a custom connection line now renders inside the transform — census it').toBe(0)
    expect(count(/<EdgeLabelRenderer[\s/>]/), 'CONTRAST CONTROL: sweep cannot see a symbol that is present')
      .toBeGreaterThan(0)
  })

  it('every component rendered ACROSS the scope boundary is pinned', () => {
    // The one thing the walk cannot derive (see header). Exact, both directions.
    expect(foreign).toEqual([...FOREIGN_RENDERED].sort())
  })
})
