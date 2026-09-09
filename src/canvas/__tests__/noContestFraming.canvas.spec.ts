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
 * The swept surface. `src/canvas` is the board Paul tested; the registers are
 * included because `METRIC_NOUN`/`COMPARATIVE_COPY` are where the card
 * captions physically live.
 *
 * ⚠⚠ `winnerChipCopy.ts` ADDED 8 Sep 2026, AND ITS ABSENCE IS WHY THIS GUARD
 * WENT GREEN OVER TWO LIVE OFFENCES FOR A DAY.
 *
 * #1281 extended into that file and said so in its own commit message —
 * "the chip register moved with the canvas. Its two long-form prompts moved
 * with it" — but never added it here. So the extension was made by hand and
 * left unguarded, and the hand missed two of the six strings:
 *
 *     'What makes this lead?'                        (the DEFINITIVE arm)
 *     `What would make "${label}" lead instead? …`   (the PROMPT)
 *
 * Both were live at `8a4f5156` with this file reporting 45/45 green.
 *
 * ⭐ THE POINT IS NOT THE TWO STRINGS, IT IS THE SHAPE. A file edited under a
 * ruling but left outside the ruling's guard is a hand-maintained mirror
 * (CLAUDE.md trap 12) — and this one drifted inside twenty-four hours, which
 * is faster than any of the estate's other mirrors have managed. The chip
 * register is in scope for the same reason the two caption registers are:
 * a phrase banned on the option card but permitted in the register the card's
 * sibling chip is read from is no ban at all. #1281's own justification for
 * touching it was that leaving the two divergent "would have put two different
 * vocabularies on one journey"; that argument is what puts it in scope here.
 */
const SCOPE_DIRS = [
  'src/canvas',
  // ⭐ ADDED after #1310. `src/v5/blocks` renders the conversation's cards and
  // was OUTSIDE this sweep, so a contest phrase could live there indefinitely
  // with the canvas guard green. Measured before adding: 22 ban-list hits in
  // the directory, ALL of them either comment prose (already skipped) or
  // `go-ahead`, which is a pinned survivor. Adding it introduced ZERO new
  // offences — the widening is a floor being raised, not a defect being fixed.
  'src/v5/blocks',
]
const SCOPE_FILES = [
  'src/components/results/utils/goalAnchorCopy.ts',
  'src/canvas/nodes/shared/metricVocabulary.ts',
  'src/components/results/utils/winnerChipCopy.ts',
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
  // ⚠⚠ THE SINGULAR VERB WAS A REAL GAP, FOUND BY A SIBLING GUARD RATHER THAN
  // BY THIS ONE. `\bleads\b` walked straight past three live chips — "Why
  // does this lead?", "What would make this lead?", "for another option to
  // lead instead of X" — and the census spec's own CONTROL string was one of
  // them.
  //
  // ⛔ AND THE FIRST FIX WAS TOO WIDE, WHICH IS THE HALF WORTH RECORDING.
  // `\b(?:this|it) leads?\b` caught "Where else could this lead?" — a
  // deliberately CAUSAL door on outcome nodes, whose own comment says it
  // "asks for the consequence". `lead` is genuinely ambiguous between "be in
  // front" and "result in", and no punctuation rule separates them
  // (CLAUDE.md trap 22f: when a predicate over natural language oscillates,
  // stop adding rules and make the limit explicit).
  //
  // ⚠ SO THIS ENTRY IS AN ENUMERATION OF THE COMPETITIVE CONSTRUCTIONS FOUND
  // LIVE, NOT A CLAIM TO COVER THE VERB. A bare `\blead\b` cannot be banned
  // at all: `lead` is a live copy KEY on every pre-analysis signal row
  // ("lead"/"emphasis") and "lead-in" is ordinary English. A fourth
  // competitive construction would pass, and that is a known, stated gap.
  //
  // ⭐⭐ THE FOURTH AND FIFTH ARRIVED, 8 Sep 2026 — EXACTLY AS THE PARAGRAPH
  // ABOVE PREDICTED, AND WITHIN A DAY OF IT BEING WRITTEN.
  //
  //     'What makes this lead?'                       → `makeS`, not `make`
  //     `What would make "${label}" lead instead? …`  → object is a LABEL,
  //                                                     not `this`/`it`
  //
  // Both were live in `winnerChipCopy.ts`. Measured at `8a4f5156`: this entry
  // caught NEITHER, while its own positive control ("What would make this
  // lead?") was caught — so the miss was the enumeration's, not the sweep's.
  //
  // ⚠ THE TWO MISSES ARE DIFFERENT SHAPES, WHICH IS THE USEFUL PART. The first
  // is an INFLECTION the enumeration simply did not spell (`makes?` now does).
  // The second is a construction whose OBJECT is an interpolated option label,
  // so no `(?:this|it)` alternation could ever have reached it — the enumerated
  // shapes were all written against the canvas, where the chips address the
  // card they sit on and therefore always say "this". A register consumed by a
  // LIST addresses options by name. Enumerating from one surface's grammar and
  // sweeping a second surface is how the gap opened.
  //
  // ⛔ `\blead instead\b` IS DELIBERATELY NARROW — not `\blead\b` near a label.
  // "instead" is what makes the construction comparative; without it, "lead"
  // beside a quoted name is as likely to be causal ("what would make X lead to
  // a better outcome"). The survivor controls below pin that distinction, and
  // trap 22f applies unchanged: this is still an enumeration, a sixth
  // construction would still pass, and the honest move remains to say so.
  //
  // ⚠⚠ THE CAUSAL LOOKAHEAD IS CARRIED ONTO THE NEW LIMB, AND IT IS NOT
  // DECORATION — the first draft of this widening omitted it and was measured
  // firing on "What makes this lead to a better outcome?", which is the exact
  // causal sense the outcome-node door uses. That is the SAME over-widening
  // #1281 recorded making and reverting one limb earlier ("the first fix was
  // too wide"), reproduced by the next hand to touch the entry. Running the
  // obvious next tweak and checking what it breaks costs one probe (trap 22f);
  // the survivor row below is that probe, made permanent.
  {
    name: 'lead (verb)',
    re: /\bto lead\b(?!\s+(?:to|into|toward))|\bleads? over\b|\bmakes? (?:this|it) lead\b(?!\s+(?:to|into|toward))|\blead instead\b/i,
  },
  // ⭐⭐ ADDED after #1310, which came within one merge of reversing #1281 by
  // taking `Support` back to `Scored highest` — and would have merged GREEN,
  // because it moved 20+ spec files in lockstep with the copy it changed. A
  // change that edits both the wording AND the tests that check the wording
  // has no independent oracle; this guard is that oracle.
  //
  // Measured in scope at `342ab3b5` before adding: ZERO live occurrences, so
  // this entry costs nothing today and REDs the moment the phrasing returns.
  // ⚠ Bare `highest` is deliberately NOT banned — 60 in-scope occurrences,
  // legitimate ones like "highest-severity", "highest-priority", "highest
  // impact first". Banning it would red on ordinary English within a week.
  { name: 'scored highest', re: /\bscored highest\b|\bscores? highest\b/i },
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
    ['What would make this lead?', 'lead (verb)'],
    // ⭐ THE TWO CONSTRUCTIONS THIS GUARD MISSED WHILE THEY WERE LIVE. Kept as
    // separate rows from the `make this lead` case above, because they failed
    // for two DIFFERENT reasons (inflection; interpolated object) and a single
    // row would let one regression hide behind the other.
    ['What makes this lead?', 'lead (verb)'],
    ['What would make "Option B" lead instead? What changes would be needed?', 'lead (verb)'],
    ['Consolidate scored highest against your goal', 'scored highest'],
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
    'Bold lead-in before a row nudge',
    'Which decision is most likely to lead to a robust result?',
    // ⛔ The outcome-node door. CAUSAL, and the first draft of the
    // `lead (verb)` entry broke it — pinned so a re-widening REDs here.
    'Where else could this lead?',
    // ⛔ THE SAME DOOR, IN THE INFLECTION THE 8 Sep WIDENING ADDED. "Where else
    // could this lead?" does NOT exercise the new `makes? (?:this|it) lead`
    // limb — no "makes" — so it could not have caught that limb's causal
    // over-fire. A survivor control only covers the limb it actually reaches
    // (CLAUDE.md trap 13: a control proves the instrument sees what it is
    // POINTED AT), which is why this row exists rather than relying on its
    // neighbour.
    'What makes this lead to a better outcome?',
    'The numbers behind these are mine, not yours.',
    'This reshapes your model, so it needs your go-ahead before it is applied.',
    'text-gray-400 hover:text-gray-600 text-2xl leading-none',
    // ⛔ Bare `highest` survives. These are live in scope and are not races.
    'the highest-severity item sets the tone',
    'Get next fixable issue (highest impact first)',
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
    // A caption that reaches assistive tech is copy, not an identifier.
    'Leader by a narrow margin',
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
    // The widened scope must actually be walked — a scope entry that resolves
    // to nothing reads exactly like a clean sweep (CLAUDE.md trap 13e).
    expect(files.some((f) => f.includes('src/v5/blocks/'))).toBe(true)
    expect(files.some((f) => f.endsWith('src/components/results/utils/goalAnchorCopy.ts'))).toBe(
      true,
    )
    // ⭐ Each SCOPE_FILES entry is asserted BY NAME, not by counting the list.
    // A count would stay green if an entry were swapped for another; this is
    // the file whose omission let two live offences sit under a green sweep,
    // so its membership is pinned rather than inferred.
    expect(files.some((f) => f.endsWith('src/components/results/utils/winnerChipCopy.ts'))).toBe(
      true,
    )
  })

  it('no user-visible canvas copy asserts that one option defeated the others', () => {
    const offences = sweep()
    const report = offences.map((o) => `${o.file}:${o.line} [${o.frames.join(',')}] ${o.text}`)
    expect(report).toEqual([])
  })
})
