import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { jsxSourceFilesIn } from '../../../../tests/helpers/jsxTextEntryScan'
import { PROTECTED_VALUE_CLASS, PROTECTED_VALUE_STYLE, TRUNCATING_LABEL_STYLE } from '../truncation'

/**
 * ⭐⭐⭐ A VALUE MUST NEVER TRUNCATE. THIS IS THE GATE FOR `../truncation.ts`.
 *
 * The rule was ratified twice (see `../truncation.ts`) and enforced at roughly a
 * dozen sites by hand — then missed at two, because a hand-enforced rule is only as
 * good as whoever last wrote a badge. The deployed edge badge painted
 * `Sensitive · 5…`, with the digits of the flip risk eaten by the ellipsis. A
 * cut-off number is worse than an absent one: the reader does not see a gap,
 * they see the wrong magnitude.
 *
 * ⭐ WHAT IT TESTS, and it is mechanical: **is the quantity inside the
 * truncating element's own subtree, or in a sibling?** A `truncate` NEXT TO a
 * value is correct and stays green. A `truncate` AROUND a value REDs. That
 * single discrimination decides badges nobody has written yet, which is why
 * this is a rule and not a list of the two sites that were wrong.
 *
 * ⭐⭐ IT USES THE TYPESCRIPT PARSER, FOR A REASON THIS ESTATE ALREADY PAID FOR.
 * `actionColourMeansPressable.spec.ts` records four hand-rolled tokenisers
 * defeated in one night — by generics, by comparisons, by template literals and
 * finally by an ordinary English apostrophe that erased a planted violation
 * while leaving every control clean. A parser also makes the comment/prose
 * false positive unrepresentable: the enumerating sweep of this class found 41
 * of 184 raw grep hits were comments, two of them the very comments EXPLAINING
 * this rule. A guard that cannot tell a use from a mention reads the
 * explanation as the offence. The AST never sees a comment at all.
 *
 * ⚠⚠ WHAT THIS GUARD CANNOT SEE — stated because a blind spot is never a
 * licence, and because the next lane will otherwise read green as "clean":
 *
 *   1. **A quantity that arrives as a PROP or from another module.** It is a
 *      `string` by the time it is rendered, so neither this scan nor the type
 *      checker can tell `"£2,500,000 ARR"` from a label.
 *      `hero/InlineField.tsx` was exactly this shape — its value comes in as
 *      `value`, formatted by `computeSuccessState.ts` two files away — and it
 *      is fixed HERE BY CONSTRUCTION (that branch no longer truncates at all),
 *      not by this guard. Rule 2 below narrows the gap where the identifier is
 *      named like a magnitude, and nothing closes it in general.
 *   2. **Whether text actually fits.** That is a text-metrics question only a
 *      real browser answers. `e2e/visual/nodeTextClipping.visual.spec.ts` is
 *      the browser-side guard and it scopes to `.react-flow__node`, so it is
 *      structurally blind to edge labels (`EdgeLabelRenderer` PORTALS them out
 *      of that subtree) and to every panel. Widening it is a change in `e2e/`
 *      and is NOT done here.
 *
 * ⚠ SCOPE IS `src/canvas/`, AND THAT IS A MEASURED CHOICE, not a convenience.
 * Run repo-wide at `cfea2216`, the emitter rule flags exactly one further site:
 * `src/pages/ScenarioListPage.tsx:675`, `formatLastActivity(...)` inside a
 * `truncate`. It returns "Created 3 days ago" — a relative TIME phrase, not a
 * magnitude the reader acts on, so it is a false positive of the `format[A-Z]`
 * heuristic and adjudicating it is the price of widening this scope. The name
 * rule flags two more, both under `src/components/results/**` and both real:
 * `SuccessTargetRow.tsx:86` renders `{item.label} {operator} {item.threshold}`
 * in one `flex-1 truncate` span — an operator-plus-operand constraint whose
 * BOUND is last and therefore cut first — and `DecisionOverviewCard.tsx:666`
 * puts `unsetCount` first inside a truncating focusable button, which is
 * acceptable. Those are another lane's files; they are named here so a widening
 * finds them already adjudicated rather than rediscovering them.
 */

const CANVAS_DIR = path.resolve(__dirname, '..', '..')

/**
 * The CSS mechanisms that cut text off. `line-clamp` counts: clamping a value
 * to N lines loses digits exactly as an ellipsis does.
 *
 * Bounded by delimiters rather than `\b` — the same reason
 * `jsxTextEntryScan.ts` gives — so `truncate` does not match inside
 * `truncateAtWord`, and `min-w-0` next to `truncate` still matches.
 */
const TRUNCATING_CLASS = /(?:^|[\s'"`{])(?:truncate|text-ellipsis|overflow-ellipsis|line-clamp-\d+)(?:$|[\s'"`}])/

/**
 * ⚠⚠ THE AUTHORITY'S OWN NAMES, AND THIS IS NOT COSMETIC — THE APPLIED-CHECK
 * CAUGHT IT. Spreading `...TRUNCATING_LABEL_STYLE` removes the literal
 * `textOverflow: 'ellipsis'` from the attribute text, so the first version of
 * this scan stopped counting the very span it had just been used to fix: the
 * truncating-element census fell 95 → 93 when only ONE removal was real.
 *
 * Adopting the shared primitive would have made an element INVISIBLE to the
 * gate that exists to police it — a guard that rewards its own adoption with
 * blindness. The name is therefore a truncation mechanism in its own right.
 */
const AUTHORITY_TRUNCATION = /\bTRUNCATING_LABEL_(?:STYLE|CLASS)\b/

/**
 * RULE 1 — a quantity COMPUTED INLINE in the subtree. Rounding, fixing decimals
 * or formatting a number in the same expression that paints it is the shape the
 * flagship defect had, and it is the shape a new badge will have.
 */
const INLINE_EMITTER = {
  fixed: /\.toFixed$|\.toLocaleString$/,
  math: /^Math\.(round|floor|ceil|trunc|abs)$/,
  formatter: /(^|\.)format[A-Z]\w*$/,
}

/**
 * A unit next to an interpolation — `· ${n}%`, `£${n}`. The `%` or the currency
 * mark is what makes a bare number a MAGNITUDE, so the pair is the signal.
 *
 * ⚠ Only the LITERAL text spans are read, never the raw source of the node. The
 * first version of this tested the whole template and matched `$` in every
 * `${typography.body}` className in the repo — 2 real findings buried under
 * dozens of false ones. `$` alone is therefore not a currency mark here; it
 * counts only when it precedes a digit.
 */
const UNIT_MARK = /[%£€]|\$\s*\d/

/**
 * RULE 2 — a quantity that arrives under a MAGNITUDE NAME. This is the only
 * reach this scan has into values computed elsewhere, and it is deliberately a
 * closed vocabulary of nouns that name magnitudes rather than anything
 * number-ish: `value`, `total` as a bare word, or `data` would match half the
 * repo and the guard would be reverted within a week.
 */
const MAGNITUDE_NAME =
  /(?:^|[a-z])(?:Pct|Percent|Probability|Prob|Amount|Weight|Score|Threshold|Total|Count|DisplayText|DisplayValue)$|^(?:pct|percent|probability|amount|weight|score|threshold|displayText|displayValue)$/

interface Finding {
  readonly file: string
  readonly line: number
  readonly tag: string
  readonly reason: string
}

function attrValue(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
  name: string,
): ts.JsxAttributeValue | undefined {
  for (const p of el.attributes.properties) {
    if (ts.isJsxAttribute(p) && p.name.getText(sf) === name) return p.initializer
  }
  return undefined
}

function truncationMechanism(
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
): string | null {
  const cls = attrValue(el, sf, 'className')
  const clsText = cls ? cls.getText(sf) : ''
  if (cls && TRUNCATING_CLASS.test(clsText)) return 'className truncate/line-clamp'
  if (cls && AUTHORITY_TRUNCATION.test(clsText)) return 'className TRUNCATING_LABEL_CLASS'
  const style = attrValue(el, sf, 'style')
  if (!style) return null
  const text = style.getText(sf)
  if (/textOverflow\s*:\s*['"`]ellipsis/.test(text)) return "style textOverflow:'ellipsis'"
  if (/WebkitLineClamp\s*:/.test(text)) return 'style WebkitLineClamp'
  if (AUTHORITY_TRUNCATION.test(text)) return 'style TRUNCATING_LABEL_STYLE'
  return null
}

/**
 * The subtree that is actually PAINTED INSIDE the clipped box: children, plus
 * any prop whose value contains JSX (a render prop renders inside the element
 * it is handed to). `className`, `style`, `title`, `aria-*` and `data-*` are
 * excluded — they are not painted, and `title` in particular is a RECOVERY
 * channel, so counting it would make the recovery look like the defect.
 */
function paintedChildren(node: ts.JsxElement, sf: ts.SourceFile): ts.Node[] {
  const kids: ts.Node[] = [...node.children]
  for (const p of node.openingElement.attributes.properties) {
    if (!ts.isJsxAttribute(p) || !p.initializer) continue
    const n = p.name.getText(sf)
    if (n === 'className' || n === 'style' || n === 'title') continue
    if (n.startsWith('aria-') || n.startsWith('data-')) continue
    let hasJsx = false
    const look = (x: ts.Node): void => {
      if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) hasJsx = true
      ts.forEachChild(x, look)
    }
    look(p.initializer)
    if (hasJsx) kids.push(p.initializer)
  }
  return kids
}

function quantitiesIn(node: ts.Node, sf: ts.SourceFile, acc: string[]): void {
  if (ts.isCallExpression(node)) {
    const callee = node.expression.getText(sf)
    if (INLINE_EMITTER.fixed.test(callee) || INLINE_EMITTER.math.test(callee) || INLINE_EMITTER.formatter.test(callee)) {
      acc.push(`${callee}()`)
    }
  }
  if (ts.isTemplateExpression(node)) {
    const literals = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ')
    if (UNIT_MARK.test(literals)) acc.push(`unit template \`${literals.trim()}\``)
  }
  if (ts.isJsxText(node) && UNIT_MARK.test(node.text)) {
    acc.push(`unit text "${node.text.trim()}"`)
  }
  if (ts.isJsxExpression(node) && node.expression) {
    const named = (x: ts.Node): void => {
      // The LEAF only. `threshold.label` paints a LABEL; the object it hangs
      // off says nothing about what reaches the screen, and testing it turned
      // a correct site (ThresholdDisplay) into a false positive.
      if (ts.isPropertyAccessExpression(x)) {
        if (MAGNITUDE_NAME.test(x.name.getText(sf))) acc.push(`magnitude name \`${x.getText(sf)}\``)
        return
      }
      if (ts.isIdentifier(x)) {
        if (MAGNITUDE_NAME.test(x.getText(sf))) acc.push(`magnitude name \`${x.getText(sf)}\``)
        return
      }
      ts.forEachChild(x, named)
    }
    named(node.expression)
  }
  ts.forEachChild(node, (c) => quantitiesIn(c, sf, acc))
}

interface Scan {
  readonly findings: Finding[]
  /** Truncating elements seen. Contrast control: this must stay non-zero. */
  readonly truncating: number
  /** Elements the guard's own walk reached. */
  readonly elements: number
  /** Elements an INDEPENDENT unconditional walk reached. */
  readonly parserElements: number
}

function parserElementCount(sf: ts.SourceFile): number {
  let n = 0
  const all = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) n += 1
    ts.forEachChild(node, all)
  }
  all(sf)
  return n
}

export function scanSource(src: string, file: string): Scan {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const findings: Finding[] = []
  let truncating = 0
  let elements = 0

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      elements += 1
      const el = ts.isJsxElement(node) ? node.openingElement : node
      const how = truncationMechanism(el, sf)
      if (how) {
        truncating += 1
        // A self-closing element paints no children of its own.
        const acc: string[] = []
        if (ts.isJsxElement(node)) {
          for (const kid of paintedChildren(node, sf)) quantitiesIn(kid, sf, acc)
        }
        if (acc.length > 0) {
          findings.push({
            file,
            line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
            tag: el.tagName.getText(sf),
            reason: `${how} wraps ${[...new Set(acc)].join(', ')}`,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { findings, truncating, elements, parserElements: parserElementCount(sf) }
}

/**
 * ⭐ THE DISCRIMINATING PAIR, and it is a FIXTURE rather than a repo file on
 * purpose. A control pinned to "whatever the repo looks like now" decays into a
 * tautology the first time the repo changes (this estate has the scar); a
 * fixture pins the guard's DISCRIMINATION permanently. One arm must RED and its
 * twin must stay GREEN, and they differ only in whether the value is INSIDE the
 * truncating span or BESIDE it — which is the whole rule.
 */
const DEFECT_FIXTURE = `
export const Bad = () => (
  <div className="flex">
    <span className="min-w-0 truncate">Sensitive · {Math.round(p * 100)}%</span>
  </div>
)
`
const CORRECT_FIXTURE = `
export const Good = () => (
  <div className="flex">
    <span className="min-w-0 truncate">Sensitive</span>
    <span className="shrink-0 whitespace-nowrap">· {Math.round(p * 100)}%</span>
  </div>
)
`
/** The same defect written through the authority — see AUTHORITY_TRUNCATION. */
const DEFECT_VIA_AUTHORITY_FIXTURE = `
export const AlsoBad = () => (
  <div className="flex">
    <span style={{ fontWeight: 600, ...TRUNCATING_LABEL_STYLE }}>Sensitive · {Math.round(p * 100)}%</span>
  </div>
)
`

describe('a label may truncate; a value never may', () => {
  const files = jsxSourceFilesIn(CANVAS_DIR)
  const scans = files.map((f) => ({
    rel: path.relative(CANVAS_DIR, f),
    ...scanSource(fs.readFileSync(f, 'utf8'), path.relative(CANVAS_DIR, f)),
  }))

  it('sees a value INSIDE a truncating element, and does not fire on one BESIDE it', () => {
    const bad = scanSource(DEFECT_FIXTURE, 'fixture.tsx')
    const good = scanSource(CORRECT_FIXTURE, 'fixture.tsx')

    // Both arms must have been PARSED and must contain a truncating element,
    // or "no findings" would mean "read nothing" rather than "found nothing".
    expect(bad.truncating, 'the defect fixture parsed no truncating element').toBe(1)
    expect(good.truncating, 'the correct fixture parsed no truncating element').toBe(1)

    expect(bad.findings.map((f) => f.reason)).toHaveLength(1)
    expect(
      good.findings,
      `a value in a SIBLING was reported as a defect: ${JSON.stringify(good.findings)}`,
    ).toHaveLength(0)
  })

  it('sees the same defect written through the shared authority', () => {
    // Without this the guard would go blind exactly when a site adopts
    // `truncation.ts`, because the spread carries no literal `textOverflow`.
    const viaAuthority = scanSource(DEFECT_VIA_AUTHORITY_FIXTURE, 'fixture.tsx')
    expect(viaAuthority.truncating, 'the authority spread was not recognised as truncation').toBe(1)
    expect(viaAuthority.findings).toHaveLength(1)
  })

  it('the PROTECTED primitives do not themselves truncate', () => {
    // ⚠ THE HOLE THIS CLOSES: the scan above only asks whether a value sits
    // inside a TRUNCATING element. Add `textOverflow: 'ellipsis'` to
    // `PROTECTED_VALUE_STYLE` and every value in the repo starts clipping while
    // this file stays green — the authority hollowed out, with the gate
    // watching the wrong door. The primitives are the one thing the scan cannot
    // check by scanning, so they are asserted directly.
    expect(PROTECTED_VALUE_STYLE.textOverflow).toBeUndefined()
    expect(PROTECTED_VALUE_STYLE.overflow).toBeUndefined()
    expect(PROTECTED_VALUE_STYLE.WebkitLineClamp).toBeUndefined()
    expect(PROTECTED_VALUE_STYLE.whiteSpace, 'a value must not break across lines').toBe('nowrap')
    expect(PROTECTED_VALUE_STYLE.flexShrink, 'a value must refuse to give up width').toBe(0)
    expect(TRUNCATING_CLASS.test(` ${PROTECTED_VALUE_CLASS} `)).toBe(false)
    expect(AUTHORITY_TRUNCATION.test(PROTECTED_VALUE_CLASS)).toBe(false)

    // Positive control: the same predicates DO fire on the truncating twin, so
    // "not truncating" above is a discrimination and not a blind read.
    expect(TRUNCATING_LABEL_STYLE.textOverflow).toBe('ellipsis')
  })

  it('reaches every JSX element the parser produced', () => {
    // Independent of the guard's own traversal: if `visit` ever stops
    // descending, findings collapse to zero and every other assertion here
    // passes. This is the only one that would notice.
    for (const s of scans) {
      expect(s.elements, `${s.rel}: walker reached ${s.elements}, parser produced ${s.parserElements}`).toBe(
        s.parserElements,
      )
    }
  })

  it('is pointed at a corpus that actually contains truncation', () => {
    // Contrast control. If `TRUNCATING_CLASS` ever stops matching, the guard
    // reports a clean tree for the same reason a blind instrument does. This
    // does NOT move with the defect: fixing a value site removes a quantity
    // from inside a truncating element, not the truncation from the tree.
    expect(files.length, 'no .tsx files found under src/canvas').toBeGreaterThan(200)
    const truncating = scans.reduce((n, s) => n + s.truncating, 0)
    expect(truncating, 'found no truncating elements at all — the detector is blind').toBeGreaterThan(50)
  })

  it('finds no value inside a truncating element anywhere in src/canvas', () => {
    const findings = scans.flatMap((s) => s.findings)
    expect(
      findings.map((f) => `${f.file}:${f.line} <${f.tag}> — ${f.reason}`),
      'a VALUE is being cut off. Split it out: the label takes TRUNCATING_LABEL_CLASS/STYLE, the value takes PROTECTED_VALUE_CLASS/STYLE (src/canvas/ui/truncation.ts). If the text genuinely cannot fit, wrap it — never clip a number.',
    ).toEqual([])
  })
})
