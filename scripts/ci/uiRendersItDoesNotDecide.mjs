/**
 * ⭐⭐⭐ THE UI RENDERS THE DATA. IT DOES NOT DECIDE WHAT THE DATA MEANS.
 *
 * Founder's rule, 15 Sep 2026: *"every piece of data displayed should be a true
 * representation of it. If it's wrong, it's the CEE's job to correct it or
 * inform the user."*
 *
 * ## The precise line, and why it is drawn here
 *
 * The Reasoning tab's product IS sentences, so "never author prose" would render
 * a table. The workable form, sharpened with Panel:
 *
 *   **The UI's words may be SELECTED BY A PRODUCER FIELD, BY IDENTITY.
 *    They may never be COMPUTED FROM THE NUMBERS.**
 *
 *   `kind === 'factor' ? A : B`   ✅ identity — the producer said which kind
 *   `pct === 100      ? A : B`   ⛔ the UI decided what 100 means
 *   `score > 0.7      ? A : B`   ⛔ the UI invented a threshold
 *
 * ## The three defects this would have caught, all shipped, all found by accident
 *
 *  1. A badge printed "AI estimate" over a founder-stated £49.
 *  2. "The top driver always shows 100%" — prose chosen by `=== 100`.
 *  3. "Influence 100%" — a UI-computed quantity presented as a producer figure.
 *
 * ⚠ THIS IS A SCANNER, NOT A PROOF. It finds one shape: prose selected by a
 * numeric or relational comparison. It cannot see a claim computed three
 * functions away, and it cannot tell a true sentence from a false one. A clean
 * run means this shape is absent — nothing more. Stated rather than disguised.
 */
import ts from 'typescript'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'

const ROOTS = process.argv.slice(2).filter(a => !a.startsWith('--'))
const JSON_OUT = process.argv.includes('--json')
/**
 * ⛔ SCOPED TO THE RENDER SURFACES, DELIBERATELY.
 *
 * Unscoped, this returned 127 hits dominated by `utils/` and `validation/` —
 * `lockedSum > target` telling the user their own rows do not add up. That is
 * the UI validating INPUT, not interpreting the model, and the founder's rule
 * is about what is DISPLAYED. Scoping is therefore part of the rule, not a
 * convenience: a helper that checks arithmetic is entitled to say so.
 */
if (ROOTS.length === 0) ROOTS.push('src/canvas/nodes', 'src/canvas/ui', 'src/canvas/components', 'src/canvas/edges')

/**
 * ⭐⭐⭐ ...AND ONE HOP OUT, BECAUSE A VERDICT AUTHORED IN A HELPER IS STILL A
 * VERDICT.
 *
 * ⛔ MEASURED, 15 Sep 2026. `src/types/constraints.ts` exports
 * `jointProbabilityLabel`, which returns the WORDS "Meets all targets" /
 * "May miss targets" from `probability >= 0.40`, and `OptionCards.tsx:1046`
 * renders it. **A threshold this UI chose, turned into a claim about the
 * user's model, invisible to every root above** — because the prose is
 * authored in a types module and only the CALL appears on the render surface.
 * The same day, the same module's `constraintConfidenceColour` was found doing
 * it in colour.
 *
 * ⚠ THE SCOPING ARGUMENT ABOVE STILL HOLDS, AND THIS DOES NOT WEAKEN IT. That
 * argument is *a helper that checks arithmetic is entitled to say so* — about
 * INPUT VALIDATION, not about where a file sits. What is added here is not "all
 * of src": it is exactly the modules a render surface IMPORTS, derived from the
 * import graph rather than listed, so it cannot drift and nobody has to
 * remember to extend it.
 *
 * ⚠ ONE HOP, AND THAT IS A JUDGEMENT RATHER THAN A PRINCIPLE. Two hops reaches
 * most of `src/` and re-creates the 127-hit run that made earlier cuts useless.
 * One hop is where the estate's actual defects have been found; a claim
 * computed three functions away is still outside this instrument, which the
 * spec says out loud.
 */
function oneHopHelpers(renderFiles) {
  const out = new Set()
  for (const f of renderFiles) {
    let src
    try { src = readFileSync(f, 'utf8') } catch { continue }
    for (const m of src.matchAll(/from '(\.[^']+)'/g)) {
      const base = resolve(dirname(f), m[1])
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const cand = base + ext
        try {
          if (!statSync(cand).isFile()) continue
        } catch { continue }
        const rel = relative(process.cwd(), cand)
        // Inside src, outside the render roots, and not a test or a type-only
        // declaration — those carry no rendered prose.
        if (rel.startsWith('src/') && !ROOTS.some(r => rel.startsWith(r)) &&
            !/__tests__|__fixtures__|\.spec\.|\.d\.ts$/.test(rel)) {
          out.add(rel)
        }
        break
      }
    }
  }
  return [...out].sort()
}

/** Prose = something a reader reads, not a class name or an enum token. */
function isProse(text) {
  const t = text.trim()
  // Developer output is not a claim to the reader.
  if (/^\[/.test(t) || /^(Failed|Error|Warning|DEBUG)\b/.test(t)) return false
  if (/^</.test(t) || /^https?:/.test(t)) return false  // markup and URLs are not claims
  // CSS values read as prose to a word-counter — `drop-shadow(0 0 2px var(…))`
  // has four "words" and a lower-case letter. They are style, not sentences.
  if (/\b(var\(--|drop-shadow\(|rgba?\(|translate|calc\()/.test(t)) return false
  if (t.length < 12) return false
  const words = t.split(/\s+/)
  if (words.length < 3) return false
  if (!words.some(w => w.length >= 4)) return false
  // Tailwind / CSS / testids / paths are not prose.
  if (/^[a-z0-9-]+$/.test(t)) return false
  if (/(^|\s)(flex|grid|absolute|relative|rounded|border|text-|bg-|px-|py-|gap-|w-|h-)/.test(t)) return false
  if (t.includes('/') && !t.includes(' ')) return false
  return /[a-z]/.test(t)
}

/**
 * ⛔ COUNTING IS NOT INTERPRETING — the first cut of this rule returned 305 hits
 * and was useless, because it flagged `thresholds.length === 1 ? '1 threshold'
 * : 'N thresholds'`. The UI genuinely knows how many rows it is holding; that
 * is an observation about its own render, not a claim about the model. Excluded
 * by NAME (`.length`, `.size`, `count`) rather than by heuristic, so the
 * exclusion is legible and arguable.
 *
 * What remains is the real class: a MODEL QUANTITY — a probability, a score, a
 * confidence, a percentage the producer computed — compared to a threshold the
 * UI chose, selecting what the reader is told it means.
 */
function isSelfObservation(expr) {
  const t = expr.getText()
  return /\.(length|size)\b/.test(t) || /count\b/i.test(t) || /\.filter\(|\.map\(/.test(t)
}

/** 0 and 1 are the extremes of a set or a normalised scale — facts, not
 *  cutoffs. A literal anywhere else between or beyond them was CHOSEN. */
function comparesOnlyToBoundary(node) {
  const literalValue = (s) => {
    const lit = ts.isPrefixUnaryExpression(s) ? s.operand : s
    return ts.isNumericLiteral(lit) ? Number(lit.text) : null
  }
  const vals = [literalValue(node.left), literalValue(node.right)].filter(v => v !== null)
  if (vals.length === 0) return false
  return vals.every(n => n === 0 || n === 1)
}

/**
 * ⭐⭐ A COMPARISON BETWEEN TWO RUNTIME VALUES IS A RANGE CHECK — THE UI CHOSE
 * NOTHING.
 *
 * ⛔ WITHOUT THIS, WIDENING TO THE HELPER HOP DROWNS THE SIGNAL. One file,
 * `canvas/domain/edges.ts`, contributes a dozen hits of the form
 * `params.curvature < constraints.curvature.min` → *"Curvature must be between
 * … and …"*. That is INPUT VALIDATION echoing a declared range — the exact case
 * this scanner's scoping comment already says is entitled to speak — and it
 * would have made the report a number nobody acts on, which is how the two
 * earlier 305- and 127-hit cuts died.
 *
 * ⚠ THE DISCRIMINATOR IS NOT "no literal". `probability >=
 * CONSTRAINT_CONFIDENCE_THRESHOLDS.LOW` has no literal on either side and IS a
 * violation — it is the UI's own declared cutoff. The difference is WHO OWNS
 * THE NUMBER: a SCREAMING_SNAKE constant is a cutoff this codebase declared; a
 * lowercase property chain is a value that arrived at runtime.
 *
 * ⚠ SO THIS IS A NAMING CONVENTION DOING SEMANTIC WORK, AND THAT IS STATED
 * RATHER THAN HIDDEN. It is right for this estate today and it is not a proof.
 * A cutoff stored in a lowercase field would slip past; a runtime value read
 * through a SCREAMING_SNAKE alias would be reported. Both are argued with in
 * the spec's contrast cases rather than assumed away.
 */
function comparesTwoRuntimeValues(node) {
  const isChosenNumber = (n) => {
    const e = ts.isPrefixUnaryExpression(n) ? n.operand : n
    if (ts.isNumericLiteral(e)) return true
    // A declared cutoff: FOO, FOO.BAR, FOO_BAR.BAZ — any SCREAMING_SNAKE root.
    let root = e
    while (ts.isPropertyAccessExpression(root)) root = root.expression
    return ts.isIdentifier(root) && /^[A-Z][A-Z0-9_]*$/.test(root.text)
  }
  return !isChosenNumber(node.left) && !isChosenNumber(node.right)
}

/** A comparison the UI is NOT entitled to turn into words. */
function offendingComparison(node) {
  if (!ts.isBinaryExpression(node)) return null
  if (isSelfObservation(node.left) || isSelfObservation(node.right)) return null
  const op = node.operatorToken.kind
  const RELATIONAL = [
    ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.LessThanEqualsToken,
  ]
  const EQUALITY = [
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
  ]
  /**
   * ⭐ THE BOUNDARY RULE APPLIES TO `>` AND `<` TOO — it was written for `===`
   * only, and that asymmetry was arbitrary.
   *
   * `contribution > 0` asks *is there any contribution at all* — the same
   * none/some fact as `count === 0`, spelled with a different operator. It is
   * checkable and falsifiable and the UI did not choose the 0. Whereas
   * `sensitivityRank <= 2` and `Math.abs(delta) > 0.05` name a cutoff someone
   * picked, which is the thing the UI is not entitled to do.
   *
   * Without this, five boundary checks arrived alongside the real sites and the
   * list stopped being readable — which is how a scanner quietly becomes a
   * number nobody acts on.
   */
  if (RELATIONAL.includes(op)) {
    if (comparesOnlyToBoundary(node)) return null
    if (comparesTwoRuntimeValues(node)) return null
    return `relational (${node.operatorToken.getText()})`
  }
  if (EQUALITY.includes(op)) {
    // Identity against a STRING is the allowed form — the producer named it.
    // Identity against a NUMBER is the UI deciding what that number means.
    /**
     * ⭐ 0 AND 1 ARE BOUNDARIES, NOT THRESHOLDS — and the rule was too broad
     * without this. `overlapRatio === 1` says *every* option changes the same
     * factors; `count === 0` says *none* were found. Those are facts about a
     * set, checkable and falsifiable. A THRESHOLD is a value someone CHOSE
     * between the extremes — `0.8`, `70`, `0.39` — and it is the choosing that
     * the UI is not entitled to do.
     *
     * Found by fixing two sites honestly and watching the count not move: the
     * scanner could not tell a rewritten fact from the cutoff it replaced.
     */
    const chosenThreshold = [node.left, node.right].some(s => {
      const lit = ts.isPrefixUnaryExpression(s) ? s.operand : s
      if (!ts.isNumericLiteral(lit)) return false
      const n = Number(lit.text)
      return n !== 0 && n !== 1
    })
    if (chosenThreshold) return `chosen threshold (${node.operatorToken.getText()})`
  }
  return null
}

function findComparison(expr) {
  let hit = null
  const walk = (n) => {
    if (hit) return
    const why = offendingComparison(n)
    if (why) { hit = { why, text: n.getText().slice(0, 90) }; return }
    ts.forEachChild(n, walk)
  }
  walk(expr)
  return hit
}

/**
 * ⭐⭐⭐ JSX TEXT IS WHERE THE CANVAS KEEPS ITS SENTENCES — and for two whole
 * iterations this function did not look at it.
 *
 * `<span>Key assumption unvalidated.</span>` is a `ts.JsxText` node, not a
 * string literal, so every sentence rendered as a CHILD — which is very nearly
 * all of them — was invisible. The scanner was reading aria-labels and template
 * strings and reporting on the canvas.
 *
 * ⛔ THIS IS THE SAME DEFECT AS THE `&&` GAP, ONE LEVEL DOWN: the guard was
 * blind to the ordinary form of the thing it guards, and a low number read as
 * coverage. Both were found by reading a node body, not by running the scanner.
 */
function proseIn(expr) {
  const found = []
  const walk = (n) => {
    if (ts.isJsxText(n)) {
      // JSX collapses whitespace; a child spanning lines arrives with newlines
      // and indentation that would defeat the word count.
      const flat = n.text.replace(/\s+/g, ' ').trim()
      if (isProse(flat)) found.push(flat.slice(0, 80))
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && isProse(n.text)) {
      found.push(n.text.trim().slice(0, 80))
    }
    if (ts.isTemplateExpression(n)) {
      const whole = n.getText().replace(/\$\{[^}]*\}/g, ' ').replace(/[`]/g, '')
      if (isProse(whole)) found.push(whole.trim().slice(0, 80))
    }
    ts.forEachChild(n, walk)
  }
  walk(expr)
  return found
}

function scanFile(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out = []
  const record = (condExpr, branches, node) => {
    const cmp = findComparison(condExpr)
    if (!cmp) return
    const prose = branches.flatMap(proseIn)
    if (prose.length === 0) return
    const { line } = src.getLineAndCharacterOfPosition(node.getStart())
    out.push({ file, line: line + 1, why: cmp.why, test: cmp.text, prose: prose.slice(0, 2) })
  }
  /**
   * ⭐⭐ THE THIRD SHAPE, AND IT IS THE ONE THIS CANVAS ACTUALLY USES.
   *
   * The first two cuts of this scanner walked ternaries and `if` statements
   * only — so `34 → 13` was a claim about two SYNTACTIC FORMS, not about the
   * render surface. `{cond && <p>…</p>}` is the dominant conditional in React
   * and it was invisible. It was hiding a live one: `FactorNode.tsx` gated
   * *"Key assumption unvalidated. Your result depends on this."* on
   * `sensitivityRank <= 2` and the scanner read the file clean.
   *
   * ⛔ A GUARD BLIND TO THE COMMONEST FORM OF THE THING IT GUARDS IS A GUARD
   * AGREEING WITH ITSELF. Found by reading a node body rather than by running
   * the scanner — which is the tell, and the reason this comment exists.
   *
   * Only the `&&` form is added, and only when the RIGHT side carries prose:
   * `a && b` where `b` is a boolean is not a render decision.
   */
  const walk = (n) => {
    if (ts.isConditionalExpression(n)) record(n.condition, [n.whenTrue, n.whenFalse], n)
    if (ts.isIfStatement(n)) record(n.expression, [n.thenStatement, n.elseStatement].filter(Boolean), n)
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      record(n.left, [n.right], n)
    }
    ts.forEachChild(n, walk)
  }
  walk(src)
  // One physical line reports once: an `&&` chain nests, so `a && b && <JSX>`
  // would otherwise record the same guard twice from two AST nodes.
  const seen = new Set()
  return out.filter(v => {
    const k = `${v.file}:${v.line}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function files(dir) {
  const acc = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === 'node_modules') continue
      acc.push(...files(p))
    } else if (/\.tsx?$/.test(p) && !/\.(spec|test)\.tsx?$/.test(p)) acc.push(p)
  }
  return acc
}

const renderFiles = ROOTS.flatMap(r => files(r))
// Helpers are scanned only when a render surface imports them — derived, never listed.
const scanSet = [...renderFiles, ...oneHopHelpers(renderFiles)]
const violations = scanSet.flatMap(scanFile)

if (JSON_OUT) {
  console.log(JSON.stringify(violations, null, 2))
} else {
  for (const v of violations) {
    console.log(`${relative(process.cwd(), v.file)}:${v.line}  [${v.why}]`)
    console.log(`    test:  ${v.test}`)
    console.log(`    words: ${v.prose.join(' | ')}`)
  }
  console.log(`\n${violations.length} place(s) where the UI turns a NUMBER into WORDS.`)
}
process.exit(0)
