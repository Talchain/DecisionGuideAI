/**
 * ⭐ EVERY SENTENCE IN THE POST-ANALYSIS FACTOR STACK BINDS, BY PROXIMITY, TO THE
 *    BAR IT IS ABOUT.
 *
 * ⚠ THE DEFECT THIS PINS. The stack holds TWO GROUPS, and each is a THREE-ITEM
 * group: a bar, its label below it, and a guidance sentence below that. At
 * `space-y-2` the gap BETWEEN groups was 8px while the gaps WITHIN one were
 * `mt-1` = 4px — only 2x. A reader scanning down met:
 *
 *     100%                   <- influence value
 *     Influence on results   <- ITS label
 *     Low                    <- the VoI value
 *     Investigation value    <- ITS label
 *
 * and paired `Influence on results` with the `Low` beneath it, reading
 * "influence: Low" immediately under "100%".
 *
 * ⚠⚠ AND THE FIRST FIX OF THAT DEFECT INVERTED IT INSTEAD OF CLOSING IT, WHICH IS
 * WHY THIS FILE IS SHAPED THE WAY IT IS. Widening the separator to `space-y-4`
 * fixed the two bars and left the INFLUENCE guidance sentence rendering as the
 * container's next sibling at `mt-2` = 8px — so a sentence about influence ended
 * up TWICE AS CLOSE to the value-of-information group as the two groups were to
 * each other. The absolute gap never moved; the contrast inverted against it, and
 * proximity is comparative. `inspectorStrings.ts:403-419` names that exact pair:
 * *"'influence: Low' directly above 'one of the most influential'"*.
 *
 * ⚠ THE HEADER OF THAT FIRST VERSION SAID the value-of-information block "ends
 * with `Investigation value`". FALSE — it ends with a guidance `<p>`. Its "two
 * PAIRS" model is precisely what made the third element invisible to its author:
 * a group modelled as a pair has no room in it for the thing that is actually
 * there. The model is now THREE-ITEM GROUPS, and this header says so.
 *
 * ⭐ THE DATA WAS NEVER WRONG AND THIS GUARD ASSERTS NOTHING ABOUT IT. Influence
 * and value-of-information are different quantities and both rendered correctly.
 * What is pinned is that the LAYOUT does not manufacture a false reading — and
 * the misreading is reproducible: it has caught FOUR independent readers now (a
 * reviewer who nearly filed a data-integrity defect, the author who recorded that
 * near-miss at `inspectorStrings.ts:404`, a lane that re-filed it from a deployed
 * capture on 7 Sep 2026, and the review that found the inversion above).
 *
 * ⚠ THE THREE PANELS LOOK IDENTICAL AND ARE NOT, and applying one byte-identical
 * change to all three is what produced the inversion. Controllable and Observable
 * carry the guidance INSIDE the group, which is safe by derivation:
 * `sensitivityGuidance` is non-null only when `isResultsMode && sensitivityRank
 * != null`, and the container renders on `isResultsMode && (influence != null ||
 * sensitivityRank != null)` — the first implies the second. NEITHER holds for
 * External, whose guidance is unconditional (its last branch is a plain string)
 * and is not always about influence, so there it is SEPARATED instead. The tests
 * below assert the two shapes separately rather than pretending they are one.
 *
 * ⚠ WHY A SOURCE GUARD RATHER THAN A RENDERED ONE. jsdom computes no layout, so a
 * test asserting a rendered gap would pass on any value — a test that cannot
 * fail. The class names ARE the spacing here, so reading them is the honest
 * instrument.
 *
 * ⚠ AND WHY BOTH TERMS ARE DERIVED. An earlier version computed the between-group
 * gap from source and hardcoded the within-group gap as `1 * STEP_PX`. Executed
 * by review: change the labels' `mt-1` to `mt-4` — within == between, the defect
 * fully restored and worse than the original — and the guard still computed 4 and
 * PASSED. A ratio with a frozen denominator is not a ratio; it is a floor on
 * `space-y-N` wearing a ratio's clothes. Both terms now come from the file, so
 * they move together.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import ts from 'typescript'

/** Panels whose guidance sentence lives INSIDE the group (proof in the header). */
const GROUPED_PANELS = ['FactorControllablePanel.tsx', 'FactorObservablePanel.tsx'] as const
/** The panel whose guidance is unconditional, so it is separated instead. */
const SEPARATED_PANEL = 'FactorExternalPanel.tsx'
const ALL_PANELS = [...GROUPED_PANELS, SEPARATED_PANEL] as const

/** Tailwind spacing step -> px. `space-y-2` = 8px, `mt-1` = 4px. */
const STEP_PX = 4
/** The between/within ratio below which proximity stops disambiguating. */
const REQUIRED_RATIO = 4

function panelSource(file: string): string {
  return readFileSync(join(__dirname, '..', 'panels', file), 'utf8')
}

/**
 * The stack's spacing, derived ENTIRELY from a source string — no literals about
 * the file it came from. Exported shape so the discriminating tests below can run
 * the SAME function over synthetic sources; a discriminator that re-implements the
 * arithmetic proves nothing about the guard that ships.
 *
 * `within` is the LARGEST margin inside the group slice, deliberately. The rule is
 * that the biggest gap inside a group must still be clearly smaller than the gap
 * between groups, so the maximum is the term that has to satisfy it — a minimum
 * would let one inner margin grow to the separator's size unnoticed, which is
 * exactly the mutation that defeated the previous version.
 */
function stackSpacing(src: string): { between: number; within: number; ratio: number } | null {
  const container = /className="mt-2 space-y-(\d+)"/.exec(src)
  if (!container) return null
  const between = Number(container[1]) * STEP_PX

  // The group slice: from the end of the container's own className to the close
  // of the banner that wraps the stack. The container's own `mt-2` is therefore
  // outside the slice and cannot be mistaken for an inner margin.
  const from = container.index + container[0].length
  const end = src.indexOf('</StaleGuardBanner>', from)
  const slice = src.slice(from, end === -1 ? src.length : end)

  // ⚠ MARGINS ARE READ OUT OF `className` VALUES ONLY, NEVER OUT OF FREE TEXT —
  // and this guard caught itself doing the latter. A first cut scanned the raw
  // slice for `/\bmt-(\d+)\b/`, which matched the string `` `mt-2` = 8px `` inside
  // the EXPLANATORY COMMENT that documents this very fix, and reported an 8px
  // within-group gap that no element has. A source-reading instrument has to know
  // the difference between code and prose about code; the panels are heavily
  // commented, so this is not a hypothetical.
  const classNames = [...slice.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
    (m) => m[1] ?? m[2] ?? '',
  )
  const margins = classNames.flatMap((cn) =>
    [...cn.matchAll(/\bmt-(\d+)\b/g)].map((m) => Number(m[1]) * STEP_PX),
  )
  if (margins.length === 0) return null
  const within = Math.max(...margins)
  return { between, within, ratio: between / within }
}

/**
 * ⚠⚠ THE SAME COMMENT-VS-CODE HOLE I CLOSED IN `stackSpacing`, LEFT OPEN IN THE
 * TEST SIXTY LINES BELOW IT. Round 2 executed it: restore the B1 regression —
 * guidance rendered AFTER `</StaleGuardBanner>` — and leave ANY comment inside
 * the banner that merely NAMES `{sensitivityGuidance}`, and an `indexOf` over
 * raw source finds the COMMENT and the pin PASSES. In files this heavily
 * commented, the regression the guard exists to block was one comment away from
 * invisible. Reproduced standalone before repairing it.
 *
 * So every index below is taken from COMMENT-STRIPPED source, and the stripper
 * has its own positive control — an instrument that silently strips nothing
 * would restore the hole while every assertion still read green.
 */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ') // JSX {/* … */}
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block /* … */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // line // … , but not a URL's `://`
}

/**
 * Where the influence sentence sits relative to the things it must bind to.
 *
 * ⚠ ORDER ALONE IS NOT ENOUGH, and round 2 proved it with four mutations that
 * all satisfied the previous one-line pin. `depthAtGuidance` is what closes the
 * remaining one: a guidance rendered as a DIRECT CHILD of the stack container
 * belongs to neither bar — it sits under the container's own `space-y-4`, 16px
 * from both — and no ordering test can see that, because its index is in
 * exactly the right place. Nesting can.
 */
function guidanceBinding(src: string): {
  container: number
  bar: number
  guidance: number
  voi: number
  banner: number
  depthAtGuidance: number
  closesBetweenBarAndGuidance: number
  renderedGuidanceCount: number
} {
  const code = stripComments(src)
  const container = code.search(/className="mt-2 space-y-\d+"/)
  const bar = code.indexOf('<ImportanceBar')
  // ⚠⚠ THE SAME HOLE A THIRD TIME, AND THIS TIME IN THE BINDING ITSELF. Round 3
  // (external reviewer) executed it: `indexOf('{sensitivityGuidance}')` matches
  // inside a PROP — `title={sensitivityGuidance}` contains that exact substring.
  // So adding the prop anywhere inside the banner and moving the visible <p>
  // back after `</StaleGuardBanner>` restores the literal B1 regression while
  // every assertion here reads GREEN, because the index it measured was the
  // prop's, not the render's.
  //
  // Bind to the RENDERED occurrence — `>{sensitivityGuidance}<` — which a prop
  // cannot satisfy. Same lesson as `stripComments` above and as the boundary
  // matching in the preconditions: a bare substring is not an identity.
  const guidance = code.search(/>\s*\{sensitivityGuidance\}\s*</)
  const renderedGuidanceCount = [...code.matchAll(/>\s*\{sensitivityGuidance\}\s*</g)].length
  const voi = code.indexOf('INLINE_LABELS.investigationValue')
  const banner = code.indexOf('</StaleGuardBanner>')
  const between = container >= 0 && guidance > container ? code.slice(container, guidance) : ''
  const opens = (between.match(/<div\b/g) ?? []).length
  const closes = (between.match(/<\/div>/g) ?? []).length
  const barToGuidance = bar >= 0 && guidance > bar ? code.slice(bar, guidance) : ''
  return {
    container,
    bar,
    guidance,
    voi,
    banner,
    depthAtGuidance: opens - closes,
    closesBetweenBarAndGuidance: (barToGuidance.match(/<\/div>/g) ?? []).length,
    renderedGuidanceCount,
  }
}

/**
 * Anatomy puts influence in primary content and investigation value in More.
 * Parse actual JSX parents: source order alone cannot prove this boundary or
 * keep a visible label and its invitation attached to the bar they describe.
 * The old stack instruments below remain unchanged for their mutation corpus.
 */
type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement

function jsxTag(node: JsxNode): string {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText()
}

function jsxAttribute(node: JsxNode, name: string): ts.JsxAttribute | undefined {
  const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes
  return attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === name,
  )
}

function renderedExpression(node: JsxNode, expression: string): boolean {
  return ts.isJsxElement(node) && node.children.some(child =>
    ts.isJsxExpression(child) && child.expression?.getText() === expression,
  )
}

function ancestorComponent(node: ts.Node, tag: string): ts.JsxElement | null {
  let parent: ts.Node | undefined = node.parent
  while (parent) {
    if (ts.isJsxElement(parent) && jsxTag(parent) === tag) return parent
    parent = parent.parent
  }
  return null
}

function anatomyBindings(src: string) {
  const code = stripComments(src)
  const file = ts.createSourceFile('panel.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const nodes: JsxNode[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  const importance = nodes.filter(node => jsxTag(node) === 'ImportanceBar')
  const more = nodes.filter(node => jsxTag(node) === 'InspectorMoreItems')
  const voi = nodes.filter(node => jsxTag(node) === 'DataBar' &&
    jsxAttribute(node, 'label')?.initializer?.getText() === '{INLINE_LABELS.investigationValue}')
  const visibleLabels = nodes.filter(node => jsxTag(node) === 'div' &&
    renderedExpression(node, 'INLINE_LABELS.investigationValue'))
  const invitations = nodes.filter(node => jsxTag(node) === 'p' &&
    ['evidence', 'measurement'].some(kind => renderedExpression(node, `INVESTIGATION_VALUE_INVITATION.${kind}`)))
  const externalGuidance = nodes.filter(node => jsxTag(node) === 'p' &&
    jsxAttribute(node, 'data-testid')?.initializer?.getText() === '"factor-external-guidance"')
  return { code, importance, more, voi, visibleLabels, invitations, externalGuidance }
}

function classMargins(node: JsxNode): number[] {
  const className = jsxAttribute(node, 'className')?.initializer?.getText() ?? ''
  return [...className.matchAll(/\bmt-(\d+)\b/g)].map(match => Number(match[1]) * STEP_PX)
}

describe('the post-analysis factor stack groups each bar with its own sentences', () => {
  it.each(ALL_PANELS)('%s — influence is primary and the whole investigation-value group is in More', (file) => {
    const binding = anatomyBindings(panelSource(file))
    // Counts are positive controls; removing either metric, the disclosure,
    // visible label or invitation cannot make the structural assertions pass.
    expect(binding.importance, `${file}: exactly one influence owner must remain`).toHaveLength(1)
    expect(binding.more, `${file}: the moved group needs one actual More boundary`).toHaveLength(1)
    expect(binding.voi, `${file}: the investigation-value DataBar must remain`).toHaveLength(1)
    expect(binding.visibleLabels, `${file}: the aria-label cannot replace the visible label`).toHaveLength(1)
    expect(binding.invitations, `${file}: its own invitation must remain`).toHaveLength(1)

    expect(ancestorComponent(binding.importance[0], 'InspectorMoreItems')).toBeNull()
    expect(ancestorComponent(binding.voi[0], 'InspectorMoreItems')).toBe(binding.more[0])
    const wrapper = binding.voi[0].parent
    expect(ts.isJsxElement(wrapper)).toBe(true)
    expect(jsxTag(wrapper as ts.JsxElement)).toBe('div')
    expect(binding.visibleLabels[0].parent, "the visible label must be inside its bar's own wrapper").toBe(wrapper)
    expect(binding.invitations[0].parent, "the invitation must be inside its bar's own wrapper").toBe(wrapper)
    expect(binding.voi[0].pos).toBeLessThan(binding.visibleLabels[0].pos)
    expect(binding.visibleLabels[0].pos).toBeLessThan(binding.invitations[0].pos)
    expect(ancestorComponent(binding.visibleLabels[0], 'InspectorMoreItems')).toBe(binding.more[0])
    expect(ancestorComponent(binding.invitations[0], 'InspectorMoreItems')).toBe(binding.more[0])
  })

  it('PRECONDITION: the comment stripper actually strips — otherwise every index below is raw text', () => {
    // The positive control for the instrument itself. If this stripper silently
    // stopped stripping, the M8 hole would reopen and nothing else here would
    // notice, because every assertion would still find an index.
    const withComment = '{/* mentions {sensitivityGuidance} in prose */}<p>{sensitivityGuidance}</p>'
    const stripped = stripComments(withComment)
    expect(stripped.indexOf('{sensitivityGuidance}')).toBeGreaterThan(-1) // the real render survives
    expect([...stripped.matchAll(/\{sensitivityGuidance\}/g)].length).toBe(1) // the prose mention does not
  })

  it.each(GROUPED_PANELS)('%s — the single ordinal owner replaces the retired rank sentence', (file) => {
    const binding = anatomyBindings(panelSource(file))
    expect(binding.importance).toHaveLength(1)
    expect(jsxAttribute(binding.importance[0], 'sensitivityRank')?.initializer?.getText()).toBe('{displayMetadata.sensitivityRank}')
    expect(ancestorComponent(binding.importance[0], 'InspectorMoreItems')).toBeNull()
    expect(binding.code).not.toContain('sensitivityGuidance')
    expect(binding.code).not.toContain('Ranked #')
    // This is still a pair of different quantities, with one owner for each.
    expect(binding.voi).toHaveLength(1)
    expect(ancestorComponent(binding.voi[0], 'InspectorMoreItems')).toBe(binding.more[0])
  })

  // ── THE FOUR PLACEMENTS ROUND 2 PROVED THE ONE-LINE PIN COULD NOT SEE ──────
  // Each runs the SHIPPED `guidanceBinding`, not a re-implementation.
  const BAD_PLACEMENTS = [
    [
      'M8 — the B1 regression restored, with a comment naming the guidance left inside',
      `<div className="mt-2 space-y-4"><div><ImportanceBar />
         {/* the influence sentence {sensitivityGuidance} used to live here */}
       </div><div><DataBar label={INLINE_LABELS.investigationValue} /></div></div>
       </StaleGuardBanner><p className="mt-2">{sensitivityGuidance}</p>`,
    ],
    [
      'M4 — the guidance nested INSIDE the value-of-information group',
      `<div className="mt-2 space-y-4"><div><ImportanceBar /></div>
       <div><DataBar label={INLINE_LABELS.investigationValue} />
         <p className="mt-1">{sensitivityGuidance}</p></div></div></StaleGuardBanner>`,
    ],
    [
      'M5 — the guidance outside the container but inside the banner',
      `<div className="mt-2 space-y-4"><div><ImportanceBar /></div>
       <div><DataBar label={INLINE_LABELS.investigationValue} /></div></div>
       <p className="mt-2">{sensitivityGuidance}</p></StaleGuardBanner>`,
    ],
    [
      // ROUND 3, the external reviewer's exact attack. The prop is what the old
      // bare `indexOf` bound to; the visible render is back outside the banner,
      // i.e. the literal B1 regression. This case passed the previous binding.
      'M9 — a `title=` PROP inside the banner while the visible render sits after it',
      `<div className="mt-2 space-y-4"><div><ImportanceBar title={sensitivityGuidance} />
       </div><div><DataBar label={INLINE_LABELS.investigationValue} /></div></div>
       </StaleGuardBanner><p className="mt-2">{sensitivityGuidance}</p>`,
    ],
    [
      'M3 — the guidance a direct child of the container, belonging to neither bar',
      `<div className="mt-2 space-y-4"><ImportanceBar />
       <p className="mt-1">{sensitivityGuidance}</p>
       <div><DataBar label={INLINE_LABELS.investigationValue} /></div></div></StaleGuardBanner>`,
    ],
  ] as const

  it.each(BAD_PLACEMENTS)('DISCRIMINATOR: %s is REJECTED', (_label, source) => {
    const b = guidanceBinding(source)
    const bindsToItsOwnBar =
      b.bar > -1 &&
      b.guidance > -1 &&
      b.voi > -1 &&
      b.banner > -1 &&
      b.bar < b.guidance &&
      b.guidance < b.voi &&
      b.guidance < b.banner &&
      b.depthAtGuidance >= 1 &&
      b.closesBetweenBarAndGuidance === 0
    expect(bindsToItsOwnBar).toBe(false)
  })

  it('DISCRIMINATOR: a PROP alone is not a render — M9 has no rendered guidance inside the banner', () => {
    // Pins the MECHANISM, not just the verdict: the prop must contribute zero
    // rendered occurrences, so a future refactor cannot make M9 pass by accident.
    const propOnly = `<div className="mt-2 space-y-4"><div><ImportanceBar title={sensitivityGuidance} />
       </div><div><DataBar label={INLINE_LABELS.investigationValue} /></div></div></StaleGuardBanner>`
    expect(guidanceBinding(propOnly).renderedGuidanceCount).toBe(0)
    expect(guidanceBinding(propOnly).guidance).toBe(-1)
  })

  it('DISCRIMINATOR: the CORRECT placement is accepted — the rejections are not blanket', () => {
    const good = `<div className="mt-2 space-y-4"><div><ImportanceBar />
       <p className="mt-1">{sensitivityGuidance}</p></div>
       <div><DataBar label={INLINE_LABELS.investigationValue} /></div></div></StaleGuardBanner>`
    const b = guidanceBinding(good)
    expect(b.bar).toBeLessThan(b.guidance)
    expect(b.guidance).toBeLessThan(b.voi)
    expect(b.guidance).toBeLessThan(b.banner)
    expect(b.depthAtGuidance).toBeGreaterThanOrEqual(1)
    expect(b.closesBetweenBarAndGuidance).toBe(0)
  })

  it(`${SEPARATED_PANEL} — its unconditional guidance stays separate from both metrics`, () => {
    const binding = anatomyBindings(panelSource(SEPARATED_PANEL))
    expect(binding.importance).toHaveLength(1)
    expect(binding.more).toHaveLength(1)
    expect(binding.voi).toHaveLength(1)
    expect(binding.visibleLabels).toHaveLength(1)
    expect(binding.invitations).toHaveLength(1)
    expect(binding.externalGuidance).toHaveLength(1)
    const guidance = binding.externalGuidance[0]
    const voiWrapper = binding.voi[0].parent
    expect(ancestorComponent(guidance, 'InspectorMoreItems')).toBe(binding.more[0])
    expect(ancestorComponent(binding.importance[0], 'InspectorMoreItems')).toBeNull()
    expect(guidance.parent).not.toBe(voiWrapper)
    expect(guidance.pos, 'external guidance must follow the complete VoI wrapper').toBeGreaterThan(voiWrapper.end)
    expect(renderedExpression(guidance, 'externalGuidance')).toBe(true)
    // Derive both sides from actual rendered class attributes, never from
    // comments or a made-up stack-gap value after the stack was separated.
    const guidanceMargins = classMargins(guidance)
    const ownMargins = [...classMargins(binding.visibleLabels[0]), ...classMargins(binding.invitations[0])]
    expect(guidanceMargins.length).toBeGreaterThan(0)
    expect(ownMargins.length).toBeGreaterThan(0)
    expect(Math.max(...guidanceMargins)).toBeGreaterThan(Math.max(...ownMargins))
  })

  // ── DISCRIMINATING PAIR, RUN THROUGH THE SHIPPED FUNCTION ──────────────────
  //
  // ⚠ THE PREVIOUS VERSION OF THIS TEST COULD NOT FAIL. It read
  // `expect(2 * STEP_PX / (1 * STEP_PX)).toBeLessThan(4)` — literals it defined
  // itself, against a second unlinked copy of the threshold. It read no source,
  // imported no panel and never invoked the extraction. Relaxing the real
  // threshold to `>= 2` would have let the regression through while this stayed
  // green. Both halves below now run `stackSpacing`, the function the guard above
  // actually uses.

  it('DISCRIMINATOR: the shipped extraction REDS on the regression it was written for', () => {
    const regressed = `
      <div className="mt-2 space-y-2">
        <ImportanceBar importanceScore={x} />
        <div>
          <DataBar label={INLINE_LABELS.investigationValue} />
          <div className="mt-1">{INLINE_LABELS.investigationValue}</div>
        </div>
      </div>
      </StaleGuardBanner>`
    const spacing = stackSpacing(regressed)
    expect(spacing).not.toBeNull()
    expect(spacing!.between).toBe(8)
    expect(spacing!.within).toBe(4)
    expect(spacing!.ratio).toBeLessThan(REQUIRED_RATIO)
  })

  it('DISCRIMINATOR: the shipped extraction REDS when an INNER margin grows to meet the separator', () => {
    // The mutation that defeated the frozen-denominator version: `mt-1` -> `mt-4`
    // with the separator untouched. within == between, so the ratio is 1.
    const innerGrown = `
      <div className="mt-2 space-y-4">
        <ImportanceBar importanceScore={x} />
        <div>
          <DataBar label={INLINE_LABELS.investigationValue} />
          <div className="mt-4">{INLINE_LABELS.investigationValue}</div>
        </div>
      </div>
      </StaleGuardBanner>`
    const spacing = stackSpacing(innerGrown)
    expect(spacing!.within).toBe(16)
    expect(spacing!.ratio).toBeLessThan(REQUIRED_RATIO)
  })

  it('DISCRIMINATOR: the shipped extraction PASSES a correct stack — it is not simply always red', () => {
    // A control that can only fail is worth as little as one that cannot.
    const good = `
      <div className="mt-2 space-y-4">
        <div>
          <ImportanceBar importanceScore={x} />
          <p className="mt-1">{sensitivityGuidance}</p>
        </div>
        <div>
          <DataBar label={INLINE_LABELS.investigationValue} />
          <div className="mt-1">{INLINE_LABELS.investigationValue}</div>
          <p className="mt-1">evidence</p>
        </div>
      </div>
      </StaleGuardBanner>`
    const spacing = stackSpacing(good)
    expect(spacing!.between).toBe(16)
    expect(spacing!.within).toBe(4)
    expect(spacing!.ratio).toBeGreaterThanOrEqual(REQUIRED_RATIO)
  })
})
