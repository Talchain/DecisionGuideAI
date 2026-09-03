/**
 * ONE NOUN PER IDEA, AND THE GUARD THAT KEEPS IT THAT WAY.
 *
 * Paul, 31 Aug 2026: "Four different number vocabularies on one screen, none
 * explained." The rename itself is a one-time edit; this sweep is what stops
 * the ninth word arriving quietly six weeks from now.
 *
 * WHY A SOURCE SWEEP AND NOT ONLY RENDER TESTS. The render tests in
 * `RiskNode.spec`, `OutcomeNode.spec` and `nodeMetricRow.goalDecision.spec`
 * each pin ONE card's caption, and they are the right instrument for that. But
 * a NEW card added next month with a freshly hand-typed `label="Leads"` would
 * pass all of them — it has no spec yet, so there is nothing to fail. Only a
 * sweep over the surface catches a word that nobody has written a test for.
 * That is the defect class this file exists for: not the eight words we just
 * fixed, but the ninth.
 *
 * ⚠⚠⚠ REBUILT AGAINST THE SPEC, AFTER TWO ROUNDS OF FIXING THE MUTANT IN HAND.
 *
 * Round 1 found `` `Achievement ${…}%` `` walking past `/\bAchievement:\s/`.
 * The predicate was widened to `/\bAchievement[:\s]/` — which fixed THAT
 * MUTANT and nothing else. Round 2 then walked six more through the same
 * guard, all green: `label="Achievement"` (the canonical caption position, and
 * the exact syntax the file's own sibling predicates were built on),
 * `<p>Achievement</p>`, `aria-label="Achievement"`, `label={'Leads'}`,
 * `` `Leads ${…}%` `` and `` `strength ${…}%` `` — the last two because only
 * the `Achievement` predicate had ever been widened at all.
 *
 * ⛔ SO THE THIRD ROUND DOES NOT FIX THOSE SIX EITHER. Fixing the mutants a
 * reviewer happened to type is what produced round 2, and doing it again would
 * produce round 4. The predicate below is derived from an ENUMERATION of the
 * positions a caption can occupy, and the reviewer's six are kept at the
 * bottom purely as EVIDENCE THAT THE DERIVATION COVERS THEM — never as its
 * definition. If they were deleted the guard would be no weaker.
 *
 * ⭐ THE ENUMERATION. A retired noun reaches a user's eye only by being
 * RENDERED, and on these surfaces there are exactly three ways a hand-typed
 * word gets rendered:
 *
 *   (A) as the value of a CAPTION-BEARING JSX ATTRIBUTE — `label`,
 *       `aria-label`, `title`, `placeholder`, `alt`, `aria-valuetext` — in any
 *       of its five spellings: `label="X"`, `label='X'`, `label={"X"}`,
 *       `label={'X'}`, `` label={`X ${…}`} ``;
 *   (B) as a JSX TEXT NODE — `<p>X</p>`, `<p>X 68%</p>`, `X {…}%`, or a bare
 *       run of text between tags with no delimiter on its own line at all
 *       (`OptionNode:1601` is `Leads via{' '}`, which is why the extractor
 *       cannot simply look between `>` and `<` on one line);
 *   (C) as a TEMPLATE LITERAL composed into a rendered string —
 *       `` return `X ${…}%` ``, which is how every `lodMetric` caption on this
 *       surface is built.
 *
 * Bare word · word+colon · word+whitespace · end-of-string · single- and
 * double-quoted · braced — every form the review asked for is one of A, B or
 * C, which is the point of deriving rather than listing: the enumeration is
 * over POSITIONS, and the spellings fall out of it.
 *
 * ⭐⭐ AND THE SECOND HALF, WHICH IS WHAT MAKES THE FIRST SURVIVABLE: being
 * rendered is not enough. What is banned is a CAPTION — a noun that LABELS A
 * QUANTITY. That is the distinction the register states in prose and the
 * previous predicates tried to buy with punctuation. Formally, a retired noun
 * offends when, inside a rendered run,
 *
 *   it STARTS the rendered run, and what follows it is the QUANTITY — an
 *   interpolation, a digit, a `%`, or NOTHING AT ALL — with an optional colon
 *   between: `` `Achievement ${…}%` ``, `Achievement: {…}%`,
 *   `<p>Achievement 68%</p>`, and — via the "nothing at all" arm —
 *   `label="Achievement"` and `<p>Leads</p>`.
 *
 * ⚠ That was TWO rules until a mutant proved it was one: an explicit
 * "stands alone" limb was deleted and the suite stayed green, because the
 * end-of-string arm already covered it. See `isCaptionPosition`.
 *
 * ⛔ WHY NOT SIMPLY BAN THE BARE WORD. Measured, before this was written: a
 * whole-word ban on the four retired captions fires on SEVENTEEN lines in
 * scope, sixteen of them legitimate — `<span title="Link strength">`,
 * `aria-label={`${pct}% link strength`}`, `<EstimateMarker subject="strength" />`,
 * `const strength = Math.abs(signed)`, `type EstimateSubject = 'value' | 'strength'`,
 * and the register's own `RETIRED_METRIC_NOUNS` array. `strength` is ordinary
 * English on this surface and always was; the register says so. A guard that
 * reds on all of those is worked around inside a week, and then it guards
 * nothing. The caption rule is what separates "the word appears" from "the
 * word captions a number".
 *
 * ⭐ THE BAN LIST IS DERIVED, NOT RE-TYPED. It is `RETIRED_METRIC_NOUNS`
 * itself. The previous version hand-wrote three regexes beside a four-item
 * exported array — a mirror, one item short, and the missing item
 * (`Chance of leading`) was never swept at all.
 *
 * SCOPE, stated so the absence claim means something: `src/canvas/nodes` —
 * the card surfaces that caption a number. Panels are NOT swept, because the
 * inspector renders long-form prose. `OptionPanel`'s retired "Chance of
 * leading" is pinned by a RENDER assertion instead —
 * `OptionPanel.metricNoun.spec.tsx`, which exists because round 2 proved this
 * comment's previous claim that it already did. It did not: reverting
 * `OptionPanel` to the retired caption survived 129 files / 1612 tests. A
 * false coverage claim in a comment is worse than an admitted gap, because it
 * teaches the next reader to stop looking (CLAUDE.md trap 14) — and it was
 * sitting inside the change written to abolish exactly that.
 *
 * ⚠ WHAT THIS STILL CANNOT DO.
 *  · It cannot prove the register's list is COMPLETE. A fifth quantity
 *    captioned with a fifth word nobody has thought of is invisible to it
 *    (trap 12d: derivation moves the risk, it does not remove it).
 *  · The rule requires the quantity to be ADJACENT. A caption split across two
 *    JSX elements — `<span>Achievement</span><span>{pct}%</span>` — is still
 *    caught, by the end-of-string arm on the first span; but one written as
 *    `<span>Achievement of</span>` reads as prose and passes. That is the price
 *    of sparing "Link strength" and "Leads via {factor}", and it is a
 *    JUDGEMENT, not a derivation — the syntax cannot tell a caption noun from a
 *    sentence verb, and this is where that limit lands.
 *  · It is LINE-BASED. A caption whose noun and quantity sit on different source
 *    lines is seen only as far as the end-of-string arm reaches.
 *  · ⚠ IT IS CALIBRATED TO THIS SCOPE, AND WIDENING THE SCOPE WOULD NOT BE
 *    FREE — measured rather than supposed. Running this exact predicate over
 *    the whole of `src/` (1,637 non-spec files) returns ONE hit outside these
 *    cards, and it is a FALSE POSITIVE: `mapV5AnalysisToReport.ts:916` is an
 *    object property key `strength:` on a line of its own, which the JSX-text
 *    extractor reads as a text run. Nothing on a card surface is shaped like
 *    that, which is why the scoped sweep is clean — but "extend SCOPE to catch
 *    more" is a change that needs its own survivor corpus, not a one-line edit.
 *    (That whole-tree run carried a contrast control: the LIVE captions
 *    `Strength`/`Ahead`/`Chance` returned 5 hits in the same pass, so the zero
 *    for retired captions is a real absence and not a blind instrument —
 *    CLAUDE.md trap 13e.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { METRIC_NOUN, RETIRED_METRIC_NOUNS } from '../shared/metricVocabulary'

const ROOT = path.resolve(__dirname, '../../../..')
const SCOPE = ['src/canvas/nodes']

/** (A) The attributes whose value a user reads. `testId`/`subject`/`className` are not here. */
const CAPTION_ATTR =
  /(?:aria-label|aria-valuetext|placeholder|label|title|alt)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\})/g

/** (C) Any template literal — captions on this surface are composed with these. */
const TEMPLATE = /`([^`]*)`/g

type Run = { via: 'attr' | 'template' | 'jsx'; text: string }

/**
 * Every run of text a line can put on screen, tagged with WHICH of the three
 * enumerated positions produced it.
 *
 * The tag is not decoration: the enumeration test below asserts the position
 * as well as the catch, so deleting one extractor REDs the cases that depend
 * on it BY NAME rather than being absorbed by another (CLAUDE.md trap 19 —
 * bind by identity, never by a predicate something else could satisfy).
 */
function renderedRuns(line: string): Run[] {
  const runs: Run[] = []
  for (const m of line.matchAll(CAPTION_ATTR)) {
    const v = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
    if (typeof v === 'string') runs.push({ via: 'attr', text: v })
  }
  for (const m of line.matchAll(TEMPLATE)) runs.push({ via: 'template', text: m[1] })
  // (B) JSX text is what is LEFT once the code is taken away: blank the string
  // and template literals, collapse braced expressions (innermost first, so
  // `{Math.round(x)}` goes whole), then cut on tags.
  let t = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, '``')
  let prev: string
  do {
    prev = t
    t = t.replace(/\{[^{}]*\}/g, ' ')
  } while (t !== prev)
  for (const piece of t.split(/<[^>]*>|[<>]/)) if (piece.length > 0) runs.push({ via: 'jsx', text: piece })
  return runs
}

/**
 * Is this noun CAPTIONING this run, as opposed to merely appearing in it?
 *
 * ⚠ ONE RULE, NOT TWO — AND THAT WAS MEASURED, NOT ASSUMED. This was first
 * written with an explicit `if (t === noun) return true` limb for "stands
 * alone" beside the alternation for "leads the quantity". A mutant that
 * DELETED that limb SURVIVED, green: the `$` arm of the alternation below
 * already matches the empty remainder, so the two limbs were the same limb and
 * the comment claiming they were separately load-bearing was false. It is
 * collapsed rather than kept-and-excused, because an equivalent mutant dressed
 * as a distinct rule is how a guard acquires parts nobody can account for
 * (CLAUDE.md trap 13c: a survivor is a claim, and it has to be demonstrated).
 *
 * So: the noun must START the run, and what follows it must be the QUANTITY —
 *   `${…}` an interpolation · `68` a digit · `%` · or NOTHING AT ALL, which is
 * the `$` arm and is what makes `label="Achievement"` and `<p>Leads</p>`
 * captions. An optional colon is allowed between, because `Achievement: 68%`
 * is the same caption with punctuation.
 *
 * What follows the noun being anything ELSE — a lower-case word, most of all —
 * is prose, and prose is what "Link strength" and "Leads via {factor}" are.
 */
function isCaptionPosition(run: string, noun: string): boolean {
  const t = run.trim()
  if (!t.startsWith(noun)) return false
  return /^:?\s*(\$\{|\d|%|$)/.test(t.slice(noun.length))
}

/** The offending noun on a line, and the position that rendered it — or null. */
function offence(line: string): { noun: string; via: Run['via'] } | null {
  for (const run of renderedRuns(line)) {
    for (const noun of RETIRED_METRIC_NOUNS) {
      if (isCaptionPosition(run.text, noun)) return { noun, via: run.via }
    }
  }
  return null
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === '__fixtures__') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(e) && !/\.spec\.|\.stories\./.test(e)) out.push(p)
  }
  return out
}

/**
 * Source with comments stripped.
 *
 * The `baselineVocabulary` guard learned this the expensive way: its first
 * version swept comments too and flagged eleven sites, seven of which were
 * prose ABOUT the code. A guard that reds on an explanatory comment is a guard
 * people learn to work around. This file's own header names every banned
 * string in order to explain itself, and would fire on itself without this.
 */
function stripComments(src: string): string {
  let out = ''
  let inBlock = false
  for (const raw of src.split('\n')) {
    let l = raw
    if (inBlock) {
      const end = l.indexOf('*/')
      if (end === -1) { out += '\n'; continue }
      l = l.slice(end + 2)
      inBlock = false
    }
    const open = l.indexOf('/*')
    if (open !== -1) {
      const close = l.indexOf('*/', open)
      if (close === -1) { inBlock = true; l = l.slice(0, open) }
      else l = l.slice(0, open) + l.slice(close + 2)
    }
    out += l.replace(/\/\/.*$/, '') + '\n'
  }
  return out
}

describe('canvas metric-noun vocabulary (Paul, 31 Aug 2026)', () => {
  const files = SCOPE.flatMap((d) => walk(path.join(ROOT, d)))
  const sources = files.map((f) => ({
    file: path.relative(ROOT, f),
    body: stripComments(readFileSync(f, 'utf8')),
  }))

  it('POSITIVE CONTROL: the sweep actually reads card source', () => {
    // An empty sweep satisfies every absence assertion below (trap 13). Both
    // numbers are floors well under the real figures, so they pin that the
    // walk resolved and read, without becoming a count to maintain.
    expect(files.length, 'the walk found no card sources — scope is wrong').toBeGreaterThan(5)
    const total = sources.reduce((n, s) => n + s.body.length, 0)
    expect(total, 'sources read as empty — stripComments or the walk is broken').toBeGreaterThan(50_000)
    // …and it must be reading the CARDS specifically, not just some files.
    expect(sources.map((s) => s.file)).toContain('src/canvas/nodes/DecisionNode.tsx')
    expect(sources.map((s) => s.file)).toContain('src/canvas/nodes/OutcomeNode.tsx')
  })

  it('the ban list IS the register — not a copy of it', () => {
    // The previous version hand-wrote three regexes beside a four-item
    // exported array. They agreed on the day they were written; the array's
    // fourth entry, `Chance of leading`, was never swept for at all. Deriving
    // is what stops that (trap 12), so it is asserted rather than assumed.
    expect(offence(`label="Chance of leading"`)?.noun).toBe('Chance of leading')
    expect(RETIRED_METRIC_NOUNS.length).toBeGreaterThan(3)
    for (const noun of RETIRED_METRIC_NOUNS) {
      expect(offence(`label="${noun}"`)?.noun, `"${noun}" is retired but unswept`).toBe(noun)
    }
  })

  /**
   * ⭐ THE ENUMERATION ITSELF — the derivation, in the form of a corpus.
   *
   * Each row names the POSITION it exercises and asserts the extractor that
   * catches it. This is the definition of the guard; the reviewer's mutants
   * further down are downstream of it.
   */
  it('ENUMERATION: every position a retired caption can occupy is caught', () => {
    const positions: Array<[string, string, Run['via']]> = [
      // (A) caption-bearing attributes, all five spellings
      ['A · label, double-quoted', `<NodeMetricRow label="Achievement" />`, 'attr'],
      ['A · label, single-quoted', `<NodeMetricRow label='Achievement' />`, 'attr'],
      ['A · label, braced double', `<NodeMetricRow label={"Leads"} />`, 'attr'],
      ['A · label, braced single', `<NodeMetricRow label={'Leads'} />`, 'attr'],
      ['A · label, braced template', '<NodeMetricRow label={`Leads ${pct}%`} />', 'attr'],
      ['A · aria-label', `<span aria-label="Achievement" />`, 'attr'],
      ['A · title', `<span title="Achievement" />`, 'attr'],
      ['A · placeholder', `<input placeholder="Achievement" />`, 'attr'],
      ['A · alt', `<img alt="Achievement" />`, 'attr'],
      ['A · aria-valuetext', `<div aria-valuetext="Achievement 68%" />`, 'attr'],
      // (B) JSX text nodes
      ['B · text node, bare word', `<p>Achievement</p>`, 'jsx'],
      ['B · text node, word + number', `<p>Achievement 68%</p>`, 'jsx'],
      ['B · text node, word + colon + expression', `Achievement: {Math.round(p * 100)}%`, 'jsx'],
      ['B · text node, word + expression', `Achievement {Math.round(p * 100)}%`, 'jsx'],
      ['B · text node, end of run', `<span>Leads</span>`, 'jsx'],
      // (C) template literals
      ['C · template, word + interpolation', 'return `Achievement ${Math.round(p * 100)}%`', 'template'],
      ['C · template, lower-case retired caption', 'return `strength ${pct}%`', 'template'],
      ['C · template, bare word', 'const line = `Achievement`', 'template'],
      ['C · template, word + colon', 'const line = `Achievement: ${pct}%`', 'template'],
      // the retired phrase, which the old hand-written predicates never swept
      ['A · retired phrase', `<div title="Chance of leading" />`, 'attr'],
      ['B · retired phrase', `<p>Chance of leading</p>`, 'jsx'],
    ]
    for (const [position, line, via] of positions) {
      const hit = offence(line)
      expect(hit, `NOT CAUGHT — ${position}: ${line}`).not.toBeNull()
      // Bind to the extractor by identity: if the JSX extractor is deleted,
      // the B rows must fail as B rows, not be quietly absorbed by another.
      expect(hit!.via, `caught, but by the wrong extractor — ${position}`).toBe(via)
    }
  })

  it('CONTRAST CONTROL: the predicate is NOT so wide it bans the live vocabulary', () => {
    // The other direction, and the one that makes this guard survivable. Every
    // line here is real and present in scope today. A bare-word ban fires on
    // sixteen of them; that version was measured and rejected before this one
    // was written. If a later hand widens the rule to "catch more", this is
    // the test that stops it.
    const mustSurvive: Array<[string, string]> = [
      ['the register is read by reference', `label={METRIC_NOUN.strength}`],
      ['…and so is the other noun', `label={METRIC_NOUN.ahead}`],
      ['a live noun is not a retired one', `label="Chance"`],
      ['a kebab-case test id', `testId="risk-strength-row"`],
      ['a camel-case field', `bridgeEdgeData.bridgeStrengthPct`],
      ['a local variable', `const strength = Math.abs(signed)`],
      ['…used in arithmetic', `pct: Math.round(strength * 100),`],
      ['a union member, not a caption', `export type EstimateSubject = 'value' | 'strength'`],
      ['a prop value naming a kind', `<EstimateMarker subject="strength" />`],
      ['prose where the noun is not first', `<span title="Link strength" />`],
      ['…including in a template', 'aria-label={`${p.pct}% link strength`}'],
      ['…and in a longer sentence', `<span title="Link strength not set — open this connection" />`],
      ['a conditional identifier', `{showAchievementReadout && (`],
      ['a field read', `displayMetadata.achievementProbability !== null`],
      ['a type name', `const rec = probs[recommendedId] as AchievementProbability`],
      ['a longer field name', `achievementProbabilityIsModelledBasis`],
      // ⭐ The two disclosed VERB survivors. The register decides these
      // explicitly (`RETIRED_METRIC_NOUNS` retires "Leads" AS A CAPTION only)
      // and `oneNounPerIdea.crossCard.spec.tsx` pins the decision. They are
      // here because they are the cases the caption rule exists to spare.
      ['the option card verb', `Leads via{' '}`],
      ['the decision card verb, lower case', `{headline.winnerLabel} leads in {pct} of scenarios`],
      // The register itself spells every retired noun, by design — it is the
      // authority, not a surface. It is spared by the rule rather than by an
      // exclusion list, which is why no exclusion list exists here any more.
      ['the register declaring what it retired', `export const RETIRED = ['Leads', 'Achievement'] as const`],
    ]
    for (const [why, sample] of mustSurvive) {
      expect(offence(sample)?.noun ?? null, `the predicate is too wide — it fires on ${why}: "${sample}"`).toBeNull()
    }
  })

  it('DISCRIMINATION: every arm of the caption rule decides a case the others do not', () => {
    // ⚠ The version of this test that shipped first asserted "P1 and P2 each do
    // work" — and a mutant deleting P1 stayed GREEN, because P1 was P2's `$`
    // arm written twice. These rows are one-per-ARM of the surviving
    // alternation, so no arm can be removed without a named case going red.
    expect(isCaptionPosition('Achievement', 'Achievement'), 'the `$` arm — stands alone').toBe(true)
    expect(isCaptionPosition('Achievement 68%', 'Achievement'), 'the digit arm').toBe(true)
    expect(isCaptionPosition('Achievement %', 'Achievement'), 'the percent arm').toBe(true)
    expect(isCaptionPosition('Achievement ${p}', 'Achievement'), 'the interpolation arm').toBe(true)
    expect(isCaptionPosition('Achievement: 68%', 'Achievement'), 'the optional colon').toBe(true)
    // …and the other direction for each: prose, which is the whole reason the
    // rule is not a bare-word ban.
    expect(isCaptionPosition('Achievement of the goal', 'Achievement'), 'prose is being banned').toBe(false)
    expect(isCaptionPosition('Leads via', 'Leads'), 'the verb survivor would RED').toBe(false)
    expect(isCaptionPosition('Link strength', 'strength'), 'a noun mid-phrase is not a caption').toBe(false)
    // …and the EXTRACTOR is not doing the deciding: one line, both answers.
    expect(offence(`<span title="Link strength">Leads 47%</span>`)?.noun).toBe('Leads')
  })

  /**
   * ⭐ REGRESSION CASES — EVIDENCE, NOT DEFINITION.
   *
   * The seven mutations two rounds of review ran against this guard, six of
   * which it passed while they were live on the card surface. They are kept so
   * a future rewrite cannot silently reopen them, and they are LAST because
   * they are downstream of the enumeration above: every one of them is already
   * a row in it. If this block were deleted the guard would be unchanged.
   */
  it('REGRESSION: the seven mutants that walked past earlier versions of this guard', () => {
    const shipped = [
      ['round 1 · the colon anchor', 'const m = `Achievement ${1}%`'],
      ['round 2 · M2, the canonical caption position', 'const m = <NodeMetricRow label="Achievement" />'],
      ['round 2 · M3, one space from the contrast control', 'const m = <p>Achievement</p>'],
      ['round 2 · M7, an accessible name', 'const m = <span aria-label="Achievement" />'],
      ['round 2 · M4, a ban never widened at all', 'const m = `Leads ${1}%`'],
      ['round 2 · M5, the braced spelling', "const m = <NodeMetricRow label={'Leads'} />"],
      ['round 2 · M6, the other ban never widened', 'const m = `strength ${1}%`'],
    ]
    for (const [which, line] of shipped) {
      expect(offence(line), `this guard shipped blind to it once already — ${which}: ${line}`).not.toBeNull()
    }
  })

  it('no canvas card hand-types a retired metric caption', () => {
    // ⏳ There is no exemption list any more. `lodMetricLine.ts` carried the
    // last one — `` `Achievement ${…}%` `` at the low-zoom ladder, deferred to
    // the zoom-ladder lane. That lane is blocked with no date, which would have
    // left the board saying "Achievement" zoomed out and "Chance" zoomed in for
    // days: the exact incoherence this change exists to remove. The rename was
    // taken here instead (both surfaces read the same
    // `displayMetadata.achievementProbability`, so the noun was the whole
    // defect), and the expiry test that guarded the exemption RED on its first
    // outing — naming the file and saying "DELETE its exemption" — which is
    // what it was built to do.
    const offenders = sources.flatMap(({ file, body }) =>
      body.split('\n').flatMap((line, i) => {
        const hit = offence(line)
        return hit ? [`${file}:${i + 1}  [${hit.noun}, via ${hit.via}]\n    ${line.trim().slice(0, 90)}`] : []
      }),
    )
    expect(offenders, `canvas cards still hand-type a retired caption:\n${offenders.join('\n')}`).toEqual([])
  })

  it('the register is the only place the live nouns are spelled', () => {
    // The nouns must reach the cards BY REFERENCE. A card that imports the
    // register and then hand-types the word beside it would pass the ban above
    // (the word is not retired) while re-opening the exact drift this closes.
    const cards = sources.filter((s) => /\/(Decision|Option|Goal|Outcome|Risk|Factor)Node\.tsx$/.test(s.file))
    expect(cards.length, 'no card sources matched — the filename pattern drifted').toBeGreaterThan(3)

    // ⚠ WIDENED (review of #1160, S2). This read ONLY `label="…"`, so the
    // template-literal captions `` `Strength ${pct}%` `` in OutcomeNode and
    // RiskNode — in files this PR edits — were invisible to it while the test
    // claimed the register was "the only place" the nouns are spelled. A guard
    // whose name overstates its scope teaches the next session to stop looking.
    const LIVE = /(label=["'](Ahead|Chance|Influence|Strength)["']|`(Ahead|Chance|Influence|Strength) \$\{)/
    const offenders = cards.flatMap(({ file, body }) =>
      body.split('\n').flatMap((line, i) =>
        LIVE.test(line)
          ? [`${file}:${i + 1}  a live noun is hand-typed instead of read from METRIC_NOUN\n    ${line.trim().slice(0, 90)}`]
          : [],
      ),
    )
    expect(offenders, `a live noun is spelled outside the register:\n${offenders.join('\n')}`).toEqual([])
  })

  it('the retired nouns are named apart from the live ones', () => {
    // Binds the two exports together: a word cannot be both retired and live.
    // Without this, "fixing" a failure by adding the old word back to
    // METRIC_NOUN would satisfy every other test in this file.
    const live = Object.values(METRIC_NOUN) as string[]
    for (const retired of RETIRED_METRIC_NOUNS) {
      expect(live, `"${retired}" is retired AND live — one idea has two nouns again`).not.toContain(retired)
    }
    // Discrimination: the assertion above is not passing because the lists are
    // empty or the comparison is inert.
    expect(live.length).toBeGreaterThan(3)
    expect(RETIRED_METRIC_NOUNS.length).toBeGreaterThan(2)
    expect(live).toContain('Strength')
    // ⚠ …and the case distinction the sweep depends on is real: `Strength` is
    // live while `strength` is retired. If these ever collapse, "Link strength"
    // starts REDing and the guard gets worked around.
    expect(RETIRED_METRIC_NOUNS as readonly string[]).toContain('strength')
  })
})
