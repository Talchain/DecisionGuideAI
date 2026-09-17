import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ⭐⭐⭐ PAUL'S RULE, MADE INTO A MECHANISM RATHER THAN A REMINDER (17 Sep 2026)
 *
 * > *"The design system should specify not having a single-line border anywhere.
 * > It should always be full borders, no single lines."*
 *
 * Rule 1 of the node design system, in full, because the remedy is in the same
 * sentence as the prohibition and a guard that drops the remedy invites the
 * wrong fix:
 *
 * > **Borders enclose; nothing is separated by a single line.** No `border-top`,
 * > no left-edge accent stripe, no hairline divider and no gridline anywhere in
 * > the system. A card carries a full border in its kind's colour; **a section
 * > inside a card is separated by space, or by a full border of its own**; a
 * > table's cells are each fully bordered; the risk matrix is nine bordered
 * > cells rather than four rules. *A single edge reads as a fragment of a box
 * > that was never drawn, and it puts weight on one side of a thing that is
 * > symmetrical.*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ WHY A DERIVED SOURCE SWEEP AND NOT A RENDER TEST
 * ─────────────────────────────────────────────────────────────────────────────
 * A render test can only see the elements the fixture it was given happens to
 * mount. `Sep` — the violation this guard was written for — renders in the
 * **Detailed inline body and the Standard popover** of three node kinds, so a
 * default-LOD render assertion would have passed over it in silence. Measured
 * on the deployed board the same day: **35 elements carried a top border and
 * all 35 carried a full border**, i.e. the live default view was already
 * compliant and a browser probe pointed at it would have reported the rule
 * SATISFIED while ten live call sites violated it.
 *
 * *A scope-honest check answers a narrower question than you asked, and nothing
 * malfunctions when it does — so reading harder never helps.* The sweep is over
 * the directory, so a new file cannot be added outside its scope without also
 * leaving the node system.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE GUARD CARRIES ITS OWN POSITIVE CONTROL, AND THAT IS NOT CEREMONY
 * ─────────────────────────────────────────────────────────────────────────────
 * This estate has shipped an absence probe whose pattern collapsed to the empty
 * string and reported the file's line count back as a defect count, and a sweep
 * that read zero for its target AND zero for every contrast control because the
 * search binary was a shell function the subshell did not carry. **A probe for a
 * rare condition that returns a clean zero is a claim about the probe until the
 * probe has been shown to fire.** So the first test below asserts the matcher
 * finds a synthetic violation, and the second asserts it does NOT fire on the
 * full-border forms that are the whole point of the rule. Either failing makes
 * the third test's zero unreadable, which is the correct outcome.
 */

const NODES_DIR = join(__dirname, '..')

/**
 * Tailwind single-edge border utilities: `border-t`, `border-b`, `border-l`,
 * `border-r`, with or without a width or colour suffix (`border-t-2`,
 * `border-t-panel-border`, `border-l-4 border-l-info`).
 *
 * ⚠ The boundary matters in both directions. `border-2` and `border-panel-border`
 * are FULL borders and must not match; `border-t-2` is a single edge and must.
 * The `(?![a-z])` stops `border-r` matching inside `border-radius`-ish tokens and
 * the leading `\b` stops it matching `x-border-t`.
 */
const SINGLE_EDGE = /\bborder-[tblr](?![a-z])(?:-[A-Za-z0-9/._-]+)?\b/g

/** Inline-style and raw-CSS spellings of the same thing. */
const CSS_SINGLE_EDGE = /\bborder(?:Top|Bottom|Left|Right)(?:Width|Style|Color)?\s*[:=]|border-(?:top|bottom|left|right)\s*:/g

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Specs describe violations in prose; they do not render them.
      if (entry === '__tests__') continue
      out.push(...sourceFiles(full))
      continue
    }
    if (/\.(tsx|ts|css)$/.test(entry) && !/\.spec\.|\.test\./.test(entry)) out.push(full)
  }
  return out
}

/**
 * Strip comments before matching. Every file in this tree carries a long
 * docblock, several of which QUOTE the rule and therefore contain the exact
 * string this guard forbids — including the two files this change touches.
 * A guard that reddens on its own rationale is a guard people delete.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('node design system — rule 1: borders enclose, nothing is a single line', () => {
  it('the matcher fires on every single-edge spelling (positive control)', () => {
    const violations = [
      'className="border-t border-panel-border my-1.5"',
      'className="border-b-2"',
      'className="border-l-4 border-l-info"',
      '<div className="border-r" />',
      'className="md:border-t"',
    ]
    for (const v of violations) {
      expect(v.match(SINGLE_EDGE), `matcher missed: ${v}`).not.toBeNull()
    }
    expect('style={{ borderTop: "1px solid #EEE6D8" }}'.match(CSS_SINGLE_EDGE)).not.toBeNull()
    expect('border-bottom: 1px solid var(--border);'.match(CSS_SINGLE_EDGE)).not.toBeNull()
  })

  it('the matcher does NOT fire on the full-border forms the rule prescribes (negative control)', () => {
    const compliant = [
      'className="border border-panel-border"',
      'className="border-2 border-goal"',
      'className="rounded-lg border border-[--border-emphasis]"',
      'className="border-transparent"',
      'className="border-panel-border"',
    ]
    for (const c of compliant) {
      expect(c.match(SINGLE_EDGE), `matcher false-positived on: ${c}`).toBeNull()
    }
  })

  it('reads a non-empty file set (the sweep can see)', () => {
    const files = sourceFiles(NODES_DIR)
    // Contrast: the tree must contain the six node kinds plus shared/.
    expect(files.length).toBeGreaterThan(20)
    for (const kind of ['DecisionNode.tsx', 'OptionNode.tsx', 'FactorNode.tsx', 'OutcomeNode.tsx', 'RiskNode.tsx', 'GoalNode.tsx']) {
      expect(files.some(f => f.endsWith(kind)), `sweep did not reach ${kind}`).toBe(true)
    }
    // Contrast control: the same tree DOES carry full borders, so a zero on the
    // single-edge pattern is a real absence and not a blind read.
    const withFullBorder = files.filter(f => /\bborder\b(?!-[tblr])/.test(code(readFileSync(f, 'utf8'))))
    expect(withFullBorder.length).toBeGreaterThan(0)
  })

  it('no canvas node component draws a single-edge border', () => {
    const hits: string[] = []
    for (const file of sourceFiles(NODES_DIR)) {
      const src = code(readFileSync(file, 'utf8'))
      const rel = file.slice(file.indexOf('src/'))
      src.split('\n').forEach((line, i) => {
        for (const m of line.match(SINGLE_EDGE) ?? []) hits.push(`${rel}:${i + 1}  ${m}  — ${line.trim()}`)
        for (const m of line.match(CSS_SINGLE_EDGE) ?? []) hits.push(`${rel}:${i + 1}  ${m.trim()}  — ${line.trim()}`)
      })
    }
    expect(
      hits,
      'Rule 1: borders enclose. Separate a section with SPACE (see shared/Sep.tsx) or give it a FULL border of its own.\n' +
        hits.join('\n'),
    ).toEqual([])
  })
})
