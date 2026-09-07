/**
 * ⭐⭐ THERE IS NEVER A WINNER. THE CANVAS MAY NOT FRAME A DECISION AS A RACE.
 *
 * Paul, 7 Sep 2026, of a ruling he notes he has given "numerous times":
 *
 *   "I think it's the words 'winner' or other words similar to it. We should
 *    never really be saying 'winner' anyway. **There's never a winner.**…
 *    Terminology like 'winner' is wrong."
 *
 * and the frame that governs the fix:
 *
 *   "this is not simply providing causal analysis results. **This is meant to
 *    be enhancing their critical and creative thinking.**"
 *
 * ⭐ WHY A SWEEP AND NOT A RENAME. The previous four attempts at this ruling
 * were renames — `winner` → `leader`, `leader` → `leading option`. Each kept
 * the race and moved the noun, which is why the ruling kept coming back. What
 * is banned here is the CONTEST FRAME: a claim that one option DEFEATED the
 * others. `winner`, `leader`, `ahead`, `beats`, `close call`, `performs best`
 * and `takes over` are all the same claim wearing different words, and none of
 * them is what a Monte-Carlo win share means — it is the share of simulated
 * runs that SUPPORT an option, which is a statement about evidence, not a
 * placing. A sweep is the only instrument that catches the NEXT synonym.
 *
 * ⭐⭐ WHAT THIS GUARD DOES **NOT** BAN, AND THIS IS THE LOAD-BEARING HALF.
 * The estate's withholding copy — "No single option can be put forward yet",
 * "This run did not carry a verdict, so the analysis makes no claim either
 * way" — is the product REFUSING a claim it is not entitled to make. That work
 * is correct and hard-won. The defect is the contest framing, NEVER the
 * restraint. Nothing in the ban list below fires on a refusal; if a future
 * rewording has to weaken a withholding to get past this guard, the guard is
 * wrong and the withholding wins.
 *
 * ⚠ THE BAN LIST IS TIGHT ON PURPOSE, AND THE OMISSIONS ARE DELIBERATE.
 * A guard that reds on ordinary English is worked around inside a week and
 * then guards nothing (the lesson `metricNounVocabulary.canvas.spec.ts` paid
 * for). Measured against this scope before the list was fixed, these words are
 * NOT banned because their live uses are legitimate:
 *
 *   · `leading`  — Tailwind's `leading-snug` line-height utility (69 live
 *                  occurrences under `src/canvas`), and "leading or trailing
 *                  whitespace". Only `leading option` is banned.
 *   · `won`      — `won't` / `wouldn't`, seven live user-facing sentences.
 *   · `losing`   — "without losing model authority" (onboarding).
 *   · `behind`   — "the numbers behind these are mine", "the claim behind X".
 *                  Only the CAPTION form `Behind:` is banned.
 *   · `leads to` — causal, and the correct word for it.
 *   · `go-ahead` — "needs your go-ahead before it is applied" (held proposals).
 *
 * Each of those is pinned as a SURVIVOR below, so a future widening of the ban
 * list REDs on the sentence it would have broken rather than silently
 * rewriting it.
 *
 * SCOPE, stated so the absence claim means something (CLAUDE.md trap 13e):
 * every non-spec, non-story, non-fixture `.ts`/`.tsx` under `src/canvas`, plus
 * the two shared copy registers the canvas cards read their captions from
 * (`goalAnchorCopy.ts`, `metricVocabulary.ts`) — a caption banned on the card
 * but permitted in the register it is read from would be no ban at all.
 *
 * ⚠ WHAT THIS CANNOT DO. It reads SOURCE, so it proves nothing about copy that
 * arrives on the wire from CEE. It is line-based, so a contest phrase split
 * across two source lines is invisible. And it cannot prove the ban list is
 * complete — the fifth synonym nobody has thought of passes (trap 12d:
 * derivation moves the risk, it does not remove it). It is a floor, not a
 * proof.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')

/**
 * The swept surface. `src/canvas` is the board Paul tested; the two registers
 * are included because `METRIC_NOUN`/`COMPARATIVE_COPY` are where the card
 * captions physically live.
 */
const SCOPE_DIRS = ['src/canvas']
const SCOPE_FILES = [
  'src/components/results/utils/goalAnchorCopy.ts',
  'src/canvas/nodes/shared/metricVocabulary.ts',
]

/**
 * ⭐ THE BAN LIST — one entry per way of asserting that an option DEFEATED the
 * others. Each carries the reason, because a guard whose entries are unexplained
 * is a guard the next session deletes.
 */
const CONTEST_FRAMES: ReadonlyArray<{ readonly name: string; readonly re: RegExp }> = [
  { name: 'winner', re: /\bwinners?\b/i },
  { name: 'loser', re: /\blosers?\b/i },
  { name: 'wins', re: /\bwins\b/i },
  { name: 'beats', re: /\bbeats?\b|\bbeaten\b/i },
  { name: 'came out ahead', re: /\bcame out ahead\b/i },
  // `go-ahead` is ordinary English for consent and is a live survivor.
  { name: 'ahead', re: /(?<!go[- ])\bahead\b/i },
  // The CAPTION form only — "the numbers behind these" is prose and survives.
  { name: 'Behind: caption', re: /\bbehind\s*:/i },
  { name: 'close call', re: /\bclose calls?\b/i },
  { name: 'performs best', re: /\bperforms? best\b|\bbest[- ]performing\b/i },
  { name: 'takes over', re: /\b(?:takes?|took) over\b/i },
  { name: 'outperform', re: /\boutperform\w*/i },
  { name: 'leader', re: /\bleaders?\b/i },
  { name: 'leading option', re: /\bleading options?\b/i },
  // `leads to` is causal and survives.
  { name: 'leads', re: /\bleads\b(?!\s+to\b)/i },
  { name: 'runner-up', re: /\brunner[- ]?up\b/i },
  { name: 'front-runner', re: /\bfront[- ]?runner\b/i },
]

function matchContest(text: string): string[] {
  return CONTEST_FRAMES.filter((f) => f.re.test(text)).map((f) => f.name)
}

/**
 * The three rendering positions, lifted verbatim in shape from
 * `metricNounVocabulary.canvas.spec.ts` so the two guards agree about what
 * "reaches a user's eye" means rather than each inventing an answer.
 */
const CAPTION_ATTR =
  /(?:aria-label|aria-valuetext|placeholder|label|title|alt)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\})/g
const TEMPLATE = /`([^`]*)`/g
const QUOTED = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g

/** Tailwind line-height utilities are a className, never copy. */
const TAILWIND_LEADING = /\bleading-(?:none|tight|snug|normal|relaxed|loose|\[)/

/**
 * ⛔ WHAT IS NOT COPY, AND WHY EACH EXCLUSION IS HERE RATHER THAN A JUDGEMENT
 * MADE SILENTLY IN THE SWEEP.
 *
 * Paul's ruling is about what a user READS. Three things in this scope carry
 * the retired words and are not read by anyone:
 *
 *   · ⚠⚠ WIRE FIELD NAMES — `win_probability`, `winner_label`,
 *     `conditional_winners`, `leading_option_id`. These are a CONTRACT ACROSS
 *     FOUR SERVICES (UI · CEE · PLoT · ISL). Renaming one needs the schema
 *     path and its own lane; doing it from a copy lane would break the wire.
 *     They are ROWED, not renamed, and this guard must not force the issue.
 *   · TEST IDS AND CLASS NAMES — `leading-option-pill-{id}`, `leader-row`,
 *     `edge-label-leader`. Internal selectors; a user never sees one.
 *   · LOCAL IDENTIFIERS — `winnerLabel`, `runnerUp`, `winsVia`. They shape the
 *     NEXT lane's vocabulary, which is why they are rowed as follow-up, but
 *     they are not what this ruling is about.
 *
 * ⚠ The risk of this exclusion is real and is stated rather than hidden: a
 * genuine caption written in kebab-case would be waved through. Nothing on
 * this surface is shaped that way today, and the positive controls above are
 * all prose, so the sweep's power over COPY is unaffected.
 */
const IDENTIFIER_SHAPES: readonly RegExp[] = [
  // Lower-case initial only: `winner:` is a property key, `Behind:` is a caption.
  /^[a-z_$][\w$]*\s*[:?]/,
  /^[A-Za-z_$][\w$]*(?:[-_][\w$]*)+$/, // kebab/snake selector: `leader-row`, `win_probability`
  /^[a-z][\w$]*$/, // bare lower/camel identifier: `winner`, `runnerUp`
  /^[A-Z_]{2,}$/, // SCREAMING_CASE constant
  /[,;]$/, // a trailing separator means this was code, not a sentence
  /^[\w$]+(?:\.[\w$]+)+/, // a member expression: `analysisRun.details.winner`
  /^[?:&|=+\-*/<>!]/, // a fragment of an expression, not the start of a sentence
]

function isIdentifier(run: string): boolean {
  const t = run.trim()
  if (!t) return true
  return IDENTIFIER_SHAPES.some((re) => re.test(t))
}

/** Interpolated expressions are CODE. Blank them before reading the copy. */
function blankInterpolations(text: string): string {
  return text.replace(/\$\{[^}]*\}/g, ' ')
}

function renderedRuns(line: string): string[] {
  const runs: string[] = []
  for (const m of line.matchAll(CAPTION_ATTR)) {
    const v = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
    if (typeof v === 'string') runs.push(v)
  }
  for (const m of line.matchAll(TEMPLATE)) runs.push(m[1])
  for (const m of line.matchAll(QUOTED)) runs.push(m[1] ?? m[2] ?? '')
  // (B) JSX text: what is left once code and strings are taken away.
  const stripped = line
    .replace(CAPTION_ATTR, ' ')
    .replace(TEMPLATE, ' ')
    .replace(QUOTED, ' ')
    .replace(/\{[^}]*\}/g, ' ')
  for (const m of stripped.matchAll(/>([^<>]+)</g)) runs.push(m[1])
  // A bare run of JSX text on its own line, with no delimiter at all
  // (`OptionNode`'s `Leads via{' '}` is exactly this shape).
  const bare = stripped.trim()
  if (bare && !/[{}();=<>]/.test(bare) && /[A-Za-z]/.test(bare)) runs.push(bare)
  return runs
    .map((r) => blankInterpolations(r).trim())
    .filter((r) => r && !TAILWIND_LEADING.test(r) && !isIdentifier(r))
}

/** Source lines that are comment prose, not rendered copy. */
function isCommentLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (/^(__tests__|__mocks__|__fixtures__|node_modules)$/.test(entry)) continue
      walk(full, out)
      continue
    }
    if (!/\.tsx?$/.test(entry)) continue
    if (/\.(test|spec|stories)\.tsx?$/.test(entry)) continue
    out.push(full)
  }
  return out
}

function scopeFiles(): string[] {
  const files: string[] = []
  for (const d of SCOPE_DIRS) files.push(...walk(path.join(ROOT, d)))
  for (const f of SCOPE_FILES) files.push(path.join(ROOT, f))
  return [...new Set(files)]
}

interface Offence {
  readonly file: string
  readonly line: number
  readonly text: string
  readonly frames: readonly string[]
}

function sweep(): Offence[] {
  const offences: Offence[] = []
  for (const full of scopeFiles()) {
    const rel = path.relative(ROOT, full)
    const lines = readFileSync(full, 'utf8').split('\n')
    let inBlockComment = false
    let inRetiredList = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Track /* … */ blocks so JSDoc prose (which quotes the retired words on
      // purpose, to record what the product used to say) is never swept.
      if (inBlockComment) {
        if (line.includes('*/')) inBlockComment = false
        continue
      }
      if (/\/\*/.test(line) && !/\*\//.test(line)) {
        inBlockComment = true
        continue
      }
      if (isCommentLine(line)) continue
      // ⭐ THE BAN LIST ITSELF IS NOT AN OFFENCE. `RETIRED_METRIC_NOUNS` is the
      // register's record of what the canvas STOPPED saying, and the sibling
      // guard derives its sweep from it. A guard that fires on the list of
      // banned words would force the estate to stop writing down what it
      // banned (CLAUDE.md trap 14b: the record is evidence, not copy).
      //
      // ⚠ The exemption spans the ARRAY, not the declaring line. It was
      // written line-scoped first and the array's own members walked straight
      // past it the moment the list grew long enough to be formatted across
      // several lines — a one-line exemption for a multi-line fact.
      if (/RETIRED_METRIC_NOUNS/.test(line)) inRetiredList = true
      if (inRetiredList) {
        if (/\]\s*as const/.test(line)) inRetiredList = false
        continue
      }
      // A JSX comment (`{/* … */}`) is prose, and prose in this estate QUOTES
      // the retired words on purpose — to record what the product used to say.
      for (const run of renderedRuns(line.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ').replace(/\/\/.*$/, ''))) {
        const frames = matchContest(run)
        if (frames.length > 0) offences.push({ file: rel, line: i + 1, text: run.trim(), frames })
      }
    }
  }
  return offences
}

describe('the canvas never frames a decision as a contest', () => {
  /**
   * ⭐ POSITIVE CONTROL FIRST — an absence assertion is vacuous until the
   * instrument has been shown to see a presence (CLAUDE.md trap 13). One case
   * per ban-list entry, so deleting any single entry REDs by name rather than
   * being absorbed by a neighbour (trap 19).
   */
  it.each([
    ['Acquire Competitor is the clear winner', 'winner'],
    ['the loser of this comparison', 'loser'],
    ['Wins via Market Growth', 'wins'],
    ['Option A beats Option B', 'beats'],
    ['came out ahead in 78% of simulated scenarios', 'came out ahead'],
    ['Ahead 47%', 'ahead'],
    ['Behind: fewer key changes', 'Behind: caption'],
    ['Close call with the leading option', 'close call'],
    ['Retrofit performs best at 61%', 'performs best'],
    ['If growth is above 4%, Segment takes over', 'takes over'],
    ['61% likely to outperform others', 'outperform'],
    ['New leader by a narrow margin', 'leader'],
    ['No clear leading option', 'leading option'],
    ['Segment leads in 48% of scenarios', 'leads'],
    ['Close race vs the runner-up', 'runner-up'],
    ['the front-runner on this run', 'front-runner'],
  ])('detects contest framing in %j', (sentence, expectedFrame) => {
    expect(matchContest(sentence)).toContain(expectedFrame)
  })

  /**
   * ⭐ CONTRAST CONTROL — the survivors. Every one of these is LIVE in the
   * scope today and is ordinary English, not a race. If a future widening of
   * the ban list breaks one, it REDs here rather than silently rewriting a
   * sentence that was never the defect.
   */
  it.each([
    'Adding alternative options helps reduce confirmation bias and leads to better decisions.',
    "It won't affect the analysis.",
    'Move fluidly between the canvas, Model, analysis and Olumi without losing model authority.',
    'leading or trailing whitespace',
    'The numbers behind these are mine, not yours.',
    'This reshapes your model, so it needs your go-ahead before it is applied.',
    'text-gray-400 hover:text-gray-600 text-2xl leading-none',
  ])('leaves ordinary English alone: %j', (sentence) => {
    expect(matchContest(sentence.replace(TAILWIND_LEADING, ' '))).toEqual([])
  })

  /**
   * ⛔ AND THE WITHHOLDING CORPUS — the sentences this guard must NEVER be the
   * reason someone reworded. Each is the product refusing a claim it is not
   * entitled to make. They are pinned here, verbatim, so that a rewrite which
   * weakens one has to delete a test to do it.
   */
  it.each([
    'This run did not carry a verdict, so the analysis makes no claim either way.',
    'No single option can be put forward yet.',
    'This run could not score your options against your target.',
    'Comparative support is unavailable for this run.',
    'The analysis found many ties between options, so no single option stands out.',
  ])('never fires on a withholding: %j', (sentence) => {
    expect(matchContest(sentence)).toEqual([])
  })

  /**
   * ⭐ THE IDENTIFIER FILTER NEEDS BOTH DIRECTIONS, OR IT IS THE HOLE THE
   * SWEEP WALKS THROUGH. A filter that dropped everything would make the
   * absence claim vacuous and look identical to a clean sweep (trap 13).
   */
  it.each([
    'winner: string | null',
    'runnerUp: s.runnerUpProbability,',
    'leading-option-pill-',
    'edge-label-leader',
    'winnerLabel',
    'win_probability',
  ])('treats %j as an identifier, not copy', (run) => {
    expect(isIdentifier(run)).toBe(true)
  })

  it.each([
    'Leading option',
    'Leader changed',
    'Close call with the leading option',
    'Ahead',
    'Behind: fewer key changes',
  ])('treats %j as copy, not an identifier', (run) => {
    expect(isIdentifier(run)).toBe(false)
  })

  it('the sweep can see the scope it claims to sweep', () => {
    const files = scopeFiles()
    // Contrast control on the INSTRUMENT, not the claim: a sweep that walked
    // an empty tree would report zero offences and look identical to a clean
    // one (CLAUDE.md trap 13e).
    expect(files.length).toBeGreaterThan(300)
    expect(files.some((f) => f.endsWith('src/canvas/nodes/OptionNode.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('src/components/results/utils/goalAnchorCopy.ts'))).toBe(
      true,
    )
  })

  it('no user-visible canvas copy asserts that one option defeated the others', () => {
    const offences = sweep()
    const report = offences.map((o) => `${o.file}:${o.line} [${o.frames.join(',')}] ${o.text}`)
    expect(report).toEqual([])
  })
})
