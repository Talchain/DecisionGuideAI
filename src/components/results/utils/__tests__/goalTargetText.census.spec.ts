/**
 * ⭐⭐ #2747 RE-SCOPE (DL, after Codex round 2): ONE RULE FOR TARGET TEXT, AND ITS CENSUS.
 *
 * Codex round 2 (BLOCKING): `SuccessTargetLine` called `formatGoalTarget` without the goal's `quantityFrame`; the formatter
 * (rightly) returned null for a % change of unknown frame, and the caller printed the bare stored number: "Success: 10",
 * for a level goal and a change goal alike.
 *
 * THE PRECISE CLAIM, over production sources under `src/` (tests, fixtures and stories excluded; the formatter's and
 * the limit sayer's own files excluded):
 *   R1 every `formatGoalTarget` call that passes a frame other than the literal 'level' passes `quantityFrame` too, and
 *      every `formatGoalChangeBound` call passes it;
 *   R2 NO formatter call (level calls included, #2747 r2) falls back (`??` / `||`) to anything but a string literal,
 *      `null`/`undefined` or `TARGET_NOT_CAPTURED` / `GOAL_NO_TARGET_STATE` (never `String(raw)`, never a unit formatter);
 *   R3 every `goalConstraintText` / `goalConstraintShortText` call passes the nodes it reads a target row's quantity
 *      frame from (one named exemption below);
 *   R4 (#2747 r2, "Success: 10" from the store's scalar) in a file that says a target, no SEPARATE expression prints a
 *      raw target number: `String(x)`, a template `${x}` or a number formatter (`formatSmartNumber`, `toLocaleString`,
 *      `formatWithUnit`, `formatValueWithUnit`) over a name that holds one (`threshold`, `.raw`, `fromStore`, `storeTarget`).
 *      A line that must (the user's own non-numeric words, an input's draft, a parse) says why on the line or the line
 *      above: `// target-text: <reason>`.
 *
 * ⚠ A SCANNER, NOT A PROOF: it reads call shapes. The mounted witnesses are
 * `SuccessTargetLine.batchCQuantityFrame.spec.tsx` and `GoalNode.batchCPercentagePoints.spec.tsx`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
const FORMATTERS: Readonly<Record<string, number>> = { formatGoalTarget: 3, formatGoalChangeBound: 4 }
const SAYERS = new Set(['goalConstraintText', 'goalConstraintShortText'])
const NOT_CAPTURED = new Set(['TARGET_NOT_CAPTURED', 'GOAL_NO_TARGET_STATE'])
const DEFINITIONS = new Set(['src/components/results/utils/formatGoalTarget.ts', 'src/canvas/utils/goalConstraintText.ts'])
/** R3's one exemption, with its reason. */
const R3_EXEMPT: Readonly<Record<string, string>> = {
  'src/components/results/decision-overview/statedLimits.ts': 'limits only: target rows are skipped (isGoalTargetRow) before the call',
}

export interface TargetTextViolation { readonly file: string; readonly line: number; readonly rule: 'R1' | 'R2' | 'R3' | 'R4'; readonly call: string }

/** R4: a name that holds a raw target number. */
const RAW_TARGET = /(?:^|[^A-Za-z])(?:goalThreshold|threshold|thresholdRaw|fromStore|storeTarget|StoreTarget)\b|\.raw\b|\bthreshold_raw\b/
const NUMBER_FORMATTERS = new Set(['formatSmartNumber', 'formatWithUnit', 'formatValueWithUnit'])
const R4_REASON = /\/\/\s*target-text:\s*\S/

const unparen = (node: ts.Node): ts.Node => {
  let n = node
  while (n.parent && ts.isParenthesizedExpression(n.parent)) n = n.parent
  return n
}
const allowedFallback = (e: ts.Expression): boolean =>
  ts.isStringLiteralLike(e) || e.kind === ts.SyntaxKind.NullKeyword
  || (ts.isIdentifier(e) && (e.text === 'undefined' || NOT_CAPTURED.has(e.text)))

/** The census over one source, returning violations and the count of calls it inspected. */
export function scanTargetText(file: string, text: string): { violations: TargetTextViolation[]; calls: number } {
  const violations: TargetTextViolation[] = []
  let calls = 0
  if (![...Object.keys(FORMATTERS), ...SAYERS].some(n => text.includes(n))) return { violations, calls }
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const flag = (node: ts.Node, rule: TargetTextViolation['rule'], call: string) =>
    violations.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, rule, call })
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text
      const qfIndex = FORMATTERS[name]
      if (qfIndex !== undefined) {
        calls += 1
        const frame = node.arguments[2]
        const levelOnly = frame === undefined || (ts.isStringLiteralLike(frame) && frame.text === 'level')
          || (ts.isIdentifier(frame) && frame.text === 'undefined')
        if ((!levelOnly || name === 'formatGoalChangeBound') && node.arguments.length <= qfIndex) flag(node, 'R1', name)
        const outer = unparen(node)
        const parent = outer.parent
        if (parent && ts.isBinaryExpression(parent) && parent.left === outer
          && (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || parent.operatorToken.kind === ts.SyntaxKind.BarBarToken)
          && !allowedFallback(parent.right)) flag(node, 'R2', name)
      } else if (SAYERS.has(name)) {
        calls += 1
        if (node.arguments.length < 2 && !(file in R3_EXEMPT)) flag(node, 'R3', name)
      } else if ((name === 'String' || NUMBER_FORMATTERS.has(name)) && node.arguments[0] !== undefined
        && RAW_TARGET.test(node.arguments[0].getText(sf))) {
        checkR4(node, name)
      }
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toLocaleString'
      && RAW_TARGET.test(node.expression.expression.getText(sf))) {
      checkR4(node, 'toLocaleString')
    } else if (ts.isTemplateSpan(node) && RAW_TARGET.test(node.expression.getText(sf))) {
      checkR4(node.expression, 'template')
    }
    ts.forEachChild(node, visit)
  }
  const lines = text.split('\n')
  const checkR4 = (node: ts.Node, call: string): void => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
    if (!R4_REASON.test(lines[line] ?? '') && !R4_REASON.test(lines[line - 1] ?? '')) flag(node, 'R4', call)
  }
  visit(sf)
  return { violations, calls }
}

const EXCLUDED_DIR = new Set(['__tests__', '__fixtures__', 'fixtures', 'test', '__mocks__'])
const EXCLUDED_FILE = /\.(spec|test|stories)\.tsx?$|\.d\.ts$/
function productionFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { if (!EXCLUDED_DIR.has(name)) productionFiles(full, out) }
    else if (/\.tsx?$/.test(name) && !EXCLUDED_FILE.test(name)) out.push(full)
  }
  return out
}
const rel = (full: string) => relative(process.cwd(), full).split(sep).join('/')

let cache: { violations: TargetTextViolation[]; calls: number } | null = null
function census() {
  if (cache) return cache
  const all = productionFiles(SRC).map(rel).filter(f => !DEFINITIONS.has(f))
    .map(f => scanTargetText(f, readFileSync(join(process.cwd(), f), 'utf8')))
  cache = { violations: all.flatMap(r => r.violations), calls: all.reduce((n, r) => n + r.calls, 0) }
  return cache
}

describe('⭐ one rule for target text: the quantity frame is passed, and a null is never a bare number', () => {
  it('CONTROL: each rule fires on its defect and not on the compliant twin', () => {
    const { violations } = scanTargetText('src/components/results/Mutant.tsx', [
      'const a = formatGoalTarget(n, unit, frame)',
      'const b = formatGoalTarget(n, unit, frame, qf) ?? String(raw)',
      'const c = (formatGoalTarget(n, unit, frame, qf)) || formatWithUnit(n, unit)',
      'const d = goalConstraintText(row)',
      'const e = formatGoalChangeBound(n, unit, frame, op)',
      'const ok1 = formatGoalTarget(n, unit, frame, qf) ?? TARGET_NOT_CAPTURED',
      "const ok2 = formatGoalTarget(n, unit, 'level') ?? TARGET_NOT_CAPTURED",
      'const ok3 = formatGoalTarget(n, unit)',
      'const ok4 = goalConstraintText(row, nodes)',
      "const f = formatGoalTarget(n, unit, 'level') ?? String(n)",
      'const g = fromStore != null ? String(fromStore) : null',
      'const h = `Success: ${goalThreshold}`',
      'const i = formatSmartNumber(target.raw)',
      'const ok5 = String(target.raw) // target-text: the user\'s own non-numeric words',
    ].join('\n'))
    expect(violations.map(v => `${v.line}:${v.rule}`)).toEqual(['1:R1', '2:R2', '3:R2', '4:R3', '5:R1', '10:R2', '11:R4', '12:R4', '13:R4'])
  })

  it('CONTROL (magnitude): the census inspects the real callers, so the probe is not blind', () => {
    expect(census().calls).toBeGreaterThanOrEqual(25)
  })

  it('⭐ no production caller breaks R1, R2 or R3', () => {
    const found = census().violations.map(v => `${v.file}:${v.line} ${v.rule} ${v.call}`)
    expect(found, `target text callers off the one rule:\n  ${found.join('\n  ')}`).toEqual([])
  })
})
