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
 * MODELLED ON `baselineVocabulary.canvas.spec.ts`, deliberately — that guard
 * solved the identical shape (one object, three hand-written names, no
 * authority to rename) and its comment-stripping literal scanner is the part
 * worth reusing rather than re-inventing.
 *
 * SCOPE, stated so the absence claim means something: `src/canvas/nodes` —
 * the card surfaces that caption a number. Panels are NOT swept. That is a
 * real limit and it is deliberate: `OptionPanel`'s "Chance of leading" is
 * re-pointed by this change, but the inspector renders long-form prose where a
 * bare-literal ban would fire on legitimate sentences. The inspector's caption
 * is pinned by its own render assertion instead.
 *
 * ⚠ WHAT THIS CANNOT DO. A sweep proves agreement among the literals it can
 * SEE. It cannot prove the register's list is COMPLETE — a fifth quantity
 * captioned with a fifth word nobody has thought of yet is invisible to it
 * (CLAUDE.md trap 12d: derivation moves the risk, it does not remove it). The
 * cross-card render test at the bottom of this file is the other half: it
 * proves two surfaces agree on a WORD rather than proving no banned word
 * appears.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { METRIC_NOUN, RETIRED_METRIC_NOUNS } from '../shared/metricVocabulary'

const ROOT = path.resolve(__dirname, '../../../..')
const SCOPE = ['src/canvas/nodes']

/**
 * The retired captions, as they appeared in a `label=` or a rendered line.
 *
 * ⚠ ANCHORED TO THE CAPTION POSITION, NOT THE BARE WORD, and that precision is
 * the whole difficulty of this guard. "Chance" is a LIVE noun (`METRIC_NOUN.chance`)
 * and "strength" is a perfectly good English word that appears in prose,
 * variable names (`bridgeStrengthPct`) and test ids (`risk-strength-row`)
 * throughout this scope. A bare-word ban would fire on all of them and be
 * worked around within a week. What is banned is a hand-typed CAPTION.
 */
const BANNED: Array<{ re: RegExp; why: string }> = [
  {
    re: /label=["']Leads["']/,
    why: '`Leads` is the retired decision-card caption — use METRIC_NOUN.ahead',
  },
  {
    re: /label=["']strength["']/,
    why: '`strength` (lower case) is the retired bridge caption — use METRIC_NOUN.strength',
  },
  {
    /**
     * ⚠⚠ WIDENED AFTER THIS GUARD WAS PROVED BLIND (review of #1160).
     *
     * The first version was `/\bAchievement:\s/` — anchored on the COLON,
     * because the colon was in the one call site I happened to be fixing.
     * A reviewer re-typed the retired noun into `OutcomeNode.tsx` WITHOUT the
     * colon — the very file this spec's positive control names by hand — and
     * this sweep returned 6/6 GREEN. I reproduced it before fixing it.
     *
     * That is CLAUDE.md trap 22 exactly: the predicate was written against the
     * FAILURE MODE IN HAND rather than against the thing being banned. The
     * retired noun is "Achievement"; the colon was never part of it.
     *
     * `[:\s]` catches the caption forms — `Achievement:`, `Achievement {…}`,
     * `` `Achievement ${…}` `` — while the word boundary spares the
     * identifiers that legitimately contain it: `showAchievementReadout` (no
     * boundary before a capital A mid-word), `achievementProbability`
     * (lower case), and the type `AchievementProbability` (no `[:\s]` after).
     * All three are asserted as survivors in the not-too-wide contrast below.
     */
    re: /\bAchievement[:\s]/,
    why: '`Achievement` is the retired outcome-card caption — use METRIC_NOUN.chance',
  },
]

/**
 * ⏳ A NAMED, EXPIRING EXEMPTION — the honest way to ship a known gap.
 *
 * `lodMetricLine.ts` is inside SCOPE and carries `` `Achievement ${…}%` `` at
 * the low-zoom ladder. It is **owned by the zoom-ladder lane**, so this PR must
 * not edit it (file-ownership rule, three lanes live in this directory).
 *
 * The choice was: leave the predicate narrow so the file passes silently, or
 * widen the predicate and exempt the file BY NAME. The first hides a real
 * remaining synonym behind a green tick — and hides every future one with it.
 * The second keeps the guard honest about everything else and makes this one
 * gap visible in the failure message.
 *
 * ⚠ THIS EXEMPTION MUST DIE. The test below asserts the file STILL CONTAINS
 * the retired noun — so the moment the zoom-ladder lane's follow-up renames it,
 * this spec REDs and whoever is here deletes the exemption. An exemption that
 * cannot expire is a permanent hole with a comment on it.
 */
const EXEMPT = new Map<string, string>([
  [
    'src/canvas/nodes/shared/lodMetricLine.ts',
    'owned by the zoom-ladder lane; rename lands in its follow-up PR (see #1160 body)',
  ],
])

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

  it('CONTRAST CONTROL: every banned predicate FIRES on the string it retired', () => {
    // Each pattern is shown to match the exact literal it was written against,
    // taken from the pre-change source. Without this, an absence assertion
    // passes for the wrong reason — a typo in a regex is indistinguishable
    // from a clean sweep (trap 13).
    const wasOnTheBoard = [
      'label="Leads"',
      'label="strength"',
      'Achievement: {Math.round(displayMetadata.achievementProbability * 100)}%',
    ]
    for (const [i, sample] of wasOnTheBoard.entries()) {
      expect(BANNED[i].re.test(sample), `banned predicate ${i} never fires — sweep is blind`).toBe(true)
    }

    // ⭐ THE REGRESSION THAT THIS GUARD SHIPPED ONCE. Every one of these was
    // GREEN under the colon-anchored predicate. They are the mutant a reviewer
    // ran against `OutcomeNode.tsx` and got 6/6 passing.
    const COLONLESS = [
      'Achievement {Math.round(displayMetadata.achievementProbability * 100)}%',
      'return `Achievement ${Math.round(achievementProbability * 100)}%`',
      '<p>Achievement 68%</p>',
    ]
    for (const sample of COLONLESS) {
      expect(
        BANNED.some((b) => b.re.test(sample)),
        `the colon-less retired noun is invisible again: ${sample}`,
      ).toBe(true)
    }
  })

  it('CONTRAST CONTROL: the predicates are NOT so wide they ban the live vocabulary', () => {
    // The other direction, and the one that makes this guard survivable. A
    // ban on the bare words would fire on all of these, every one of which is
    // legitimate and present in scope today. If a later hand widens a pattern
    // to "catch more", this is the test that stops it.
    const mustSurvive = [
      `label={METRIC_NOUN.strength}`,
      `label={METRIC_NOUN.ahead}`,
      `testId="risk-strength-row"`,
      `bridgeEdgeData.bridgeStrengthPct`,
      `const achievementReadout = ...`,
      `label="Chance"`,
      // ⭐ The identifiers the WIDENED `Achievement` pattern must not eat.
      // Widening a predicate is where a guard stops being survivable, so each
      // of these is a real line from the swept scope.
      `{showAchievementReadout && (`,
      `displayMetadata.achievementProbability !== null`,
      `const rec = optionProbabilities[recommendedOptionId] as AchievementProbability`,
      `achievementProbabilityIsModelledBasis`,
    ]
    for (const sample of mustSurvive) {
      const hit = BANNED.find((b) => b.re.test(sample))
      expect(hit?.why ?? null, `a banned predicate is too wide — it fires on "${sample}"`).toBeNull()
    }
  })

  it('no canvas card hand-types a retired metric caption (outside the named exemption)', () => {
    const offenders = sources
      .filter(({ file }) => !EXEMPT.has(file))
      .flatMap(({ file, body }) =>
        body.split('\n').flatMap((line, i) => {
          const hit = BANNED.find((b) => b.re.test(line))
          return hit ? [`${file}:${i + 1}  ${hit.why}\n    ${line.trim().slice(0, 90)}`] : []
        }),
      )
    expect(offenders, `canvas cards still hand-type a retired caption:\n${offenders.join('\n')}`).toEqual([])
  })

  it('⏳ the exemption is EARNED, and it EXPIRES — the exempt file still offends', () => {
    // Three things at once, and all three are needed:
    //  (a) the exempt path exists, so the exemption is not guarding a ghost;
    //  (b) it STILL trips a banned predicate, so the exemption is doing real
    //      work rather than sitting there as a permanent licence;
    //  (c) therefore the day the zoom-ladder lane renames it, this REDs and
    //      whoever is here deletes the entry. An exemption that cannot expire
    //      is a hole with a comment on it.
    expect(EXEMPT.size, 'exemptions should be rare — re-read before adding one').toBe(1)
    for (const [file, reason] of EXEMPT) {
      const found = sources.find((sx) => sx.file === file)
      expect(found, `exempt path no longer exists: ${file} — delete the entry`).toBeDefined()
      expect(reason.length, `exemption for ${file} carries no reason`).toBeGreaterThan(20)
      const stillOffends = found!.body
        .split('\n')
        .some((line) => BANNED.some((b) => b.re.test(line)))
      expect(
        stillOffends,
        `${file} no longer hand-types a retired caption — DELETE its exemption from EXEMPT`,
      ).toBe(true)
    }
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
  })
})
