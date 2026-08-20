/**
 * ⭐ ONE CANONICAL STAGE VOCABULARY, MAPPED AT ONE NAMED EDGE — and a guard that
 * REDs when a fourth spelling appears or the edge stops being total.
 *
 * ── THE STATE THIS ENDS ──────────────────────────────────────────────────────
 * Three vocabularies coexisted across the estate, and the UI carried TWO MORE
 * spellings on top of them:
 *
 *   wire (CANONICAL)     frame | analyse | decide | review       @talchain/schemas `Stage`
 *   UI `ScenarioStage`   frame | ideate | evaluate | decide | optimise
 *   CEE V4 / DSK         frame | ideate | evaluate | decide | optimise
 *   ⚠ `applyV5State.isStage`   the wire union, HAND-SPELLED — a fourth declaration
 *   ⚠ `guidanceEvents.profile_stage`  the UI union MINUS `optimise` — a fifth,
 *                              and a WRONG one: every writer reads
 *                              `store.currentStage` (a full `ScenarioStage`), so
 *                              five call sites CAST to satisfy it and an
 *                              `optimise` value shipped as an off-type string
 *                              the declaration says cannot occur.
 *
 * Both are now DERIVED (`Stage.safeParse`, `ScenarioStage`) rather than
 * re-declared, and the five casts are gone with them.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────────
 * Name ONE canonical owner and map at the edges; remove the competitor rather
 * than translating between three forever; DO NOT MINT A FOURTH.
 *
 *   CANONICAL   `Stage` / `StageType` — the wire enum, which declares itself
 *               canonical and instructs consumers to derive from it.
 *   EDGE        `src/v5/stageMapper.ts` — the ONE place the UI's product
 *               vocabulary is translated to and from it.
 *
 * ── ⚠ WHAT THIS CANNOT DO ────────────────────────────────────────────────────
 * It is a DERIVED guard, so it proves AGREEMENT, never CORRECTNESS. The
 * allowlists are deliberately small and reviewed; a new occurrence anywhere else
 * REDs, and that is the only property claimed. Each is paired with a control
 * proving the sweep can see a violation AND discriminates a consumer from a
 * declaration.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, it, expect } from 'vitest'
import { Stage } from '@talchain/schemas/boundary'

import { scenarioStageToV5Stage, v5StageToScenarioStage } from '../stageMapper'
import type { ScenarioStage } from '../../types/scenario'

const SRC_ROOT = join(process.cwd(), 'src')

/** Files permitted to DECLARE the five-member UI vocabulary. Exactly one: the owner. */
const UI_VOCABULARY_OWNER = ['types', 'scenario.ts'].join(sep)

/** Files permitted to TRANSLATE between the two vocabularies. Exactly one: the edge. */
const TRANSLATION_EDGE = ['v5', 'stageMapper.ts'].join(sep)

const UI_ONLY = ['ideate', 'optimise'] as const

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * A DECLARATION is a SHAPE, not a count: two or more members ADJACENT IN ONE
 * LIST, separated only by `|` (a union) or `,` (an array). Separate `===`
 * comparisons are CONSUMPTION and are correct — a guard that could not tell
 * them apart would force every branching rule into an allowlist.
 *
 * ⚠ `ideate` and `optimise` are the discriminators, NOT `evaluate`.
 * `strengthenTypes.ts` declares `HelpType = 'clarify' | 'broaden' | 'challenge'
 * | 'evaluate' | 'commit'`, where `'evaluate'` is a HELP TYPE and nothing to do
 * with a stage. A homograph is not a vocabulary; sweeping on it would have
 * produced a false positive on a file this ruling has no business touching.
 */
function declaresUiVocabulary(source: string): boolean {
  const code = stripComments(source)
  const anyMember = `["'\`](?:frame|ideate|evaluate|decide|optimise)["'\`]`
  const discriminator = `["'\`](?:${UI_ONLY.join('|')})["'\`]`
  const asList = new RegExp(
    `${discriminator}\\s*[|,]\\s*(?:${anyMember}\\s*[|,]\\s*)*${anyMember}|` +
      `${anyMember}\\s*[|,]\\s*(?:${anyMember}\\s*[|,]\\s*)*${discriminator}`,
  ).test(code)
  // Same second shape as the wire predicate — see `declaresByComparisonChain`.
  // Requires a discriminator (`ideate`/`optimise`) so a chain over the shared
  // members alone is not attributed to this vocabulary.
  const asChain =
    declaresByComparisonChain(source, ['frame', 'ideate', 'evaluate', 'decide', 'optimise']) &&
    UI_ONLY.some(u => new RegExp(`===\\s*["'\`]${u}["'\`]`).test(code))
  return asList || asChain
}

/**
 * ⭐ THE SECOND SHAPE A RE-DECLARATION TAKES — added because the first version of
 * this guard MISSED IT, and the miss was found by mutation rather than by
 * reading.
 *
 * Restoring `isStage`'s hand-spelled union
 * (`v === 'frame' || v === 'analyse' || v === 'decide' || v === 'review'`) left
 * this file entirely GREEN. The list-shape predicate above only sees members
 * separated by a bare `|` or `,`; a `||` COMPARISON CHAIN is a re-declaration of
 * the same set wearing predicate clothing, and it is the exact form the real
 * defect took.
 *
 * The threshold is THREE members, and that is a judgement with a reason: a
 * two-way check (`stage === 'analyse' || stage === 'decide'`) is ordinary,
 * legitimate consumption of two stages and appears in healthy code, whereas a
 * chain naming three or more of a four-member set is enumerating the set. Both
 * readings are pinned by controls below, so the line sits where a reader can
 * see and argue with it.
 */
function declaresByComparisonChain(source: string, members: readonly string[]): boolean {
  const code = stripComments(source)
  const m = `["'\`](?:${members.join('|')})["'\`]`
  return new RegExp(`(?:===\\s*${m}\\s*\\|\\|\\s*[A-Za-z_$.[\\]]+\\s*){2,}===\\s*${m}`).test(code)
}

/** The wire union, hand-spelled — a re-declaration of something the contract owns. */
function declaresWireVocabulary(source: string): boolean {
  const code = stripComments(source)
  const m = `["'\`](?:frame|analyse|decide|review)["'\`]`
  const asList = new RegExp(
    `["'\`]analyse["'\`]\\s*[|,]\\s*(?:${m}\\s*[|,]\\s*)*${m}|${m}\\s*[|,]\\s*(?:${m}\\s*[|,]\\s*)*["'\`]analyse["'\`]`,
  ).test(code)
  return asList || declaresByComparisonChain(source, ['frame', 'analyse', 'decide', 'review'])
}

function productionSources(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__' || entry === '__fixtures__' || entry === 'test' || entry === 'fixtures') continue
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry)) continue
      if (/\.(spec|test)\.tsx?$/.test(entry) || entry.endsWith('.d.ts')) continue
      out.push(full)
    }
  }
  walk(SRC_ROOT)
  return out
}

describe('stage vocabulary — one canonical owner, one named edge, no fourth', () => {
  it('the canonical vocabulary is the wire enum, bound by identity to the contract', () => {
    expect(Stage.options).toEqual(['frame', 'analyse', 'decide', 'review'])
  })

  it('the sweep is NOT vacuous — it reads real files, and it FINDS the owner', () => {
    // ⭐ THE CONTROL WITHOUT WHICH THE TWO ABSENCE ASSERTIONS BELOW PROVE
    // NOTHING. A sweep rooted at the wrong cwd, or one whose directory filter
    // excluded everything, returns an EMPTY offender list — identical output to
    // a codebase that is genuinely clean (CLAUDE.md trap 13). So: the sweep must
    // read a plausible number of files, and it must positively identify the ONE
    // file that legitimately declares the vocabulary. If the allowlist were
    // removed, that file would be the offender — which is the discrimination
    // being demonstrated.
    const files = productionSources()
    expect(files.length, 'the sweep read almost nothing — it is pointed at the wrong tree').toBeGreaterThan(500)
    const owner = files.map(f => relative(SRC_ROOT, f)).filter(rel => rel === UI_VOCABULARY_OWNER)
    expect(owner, 'the sweep cannot see the declaring file at all').toEqual([UI_VOCABULARY_OWNER])
    expect(
      declaresUiVocabulary(readFileSync(join(SRC_ROOT, UI_VOCABULARY_OWNER), 'utf8')),
      'the owner file is not detected as declaring the vocabulary — the predicate is blind',
    ).toBe(true)
  })

  it('the UI vocabulary has exactly ONE declaration', () => {
    const offenders = productionSources()
      .map(f => relative(SRC_ROOT, f))
      .filter(rel => rel !== UI_VOCABULARY_OWNER && rel !== TRANSLATION_EDGE)
      .filter(rel => declaresUiVocabulary(readFileSync(join(SRC_ROOT, rel), 'utf8')))
    expect(
      offenders,
      'a file outside the owner and the edge re-declares the UI stage vocabulary — ' +
        'that is a fourth vocabulary, and it will drift',
    ).toEqual([])
  })

  it('the CANONICAL vocabulary is never hand-spelled outside the edge', () => {
    // ⚠ `applyV5State.isStage` was exactly this until this lane: a hand-spelled
    // `'frame' || 'analyse' || 'decide' || 'review'`, which reads GREEN while
    // being wrong — a member added in a re-vendor would be silently rejected as
    // "no stage signal". It now calls `Stage.safeParse`.
    const offenders = productionSources()
      .map(f => relative(SRC_ROOT, f))
      .filter(rel => rel !== TRANSLATION_EDGE)
      .filter(rel => declaresWireVocabulary(readFileSync(join(SRC_ROOT, rel), 'utf8')))
    expect(
      offenders,
      'a file re-declares the canonical wire vocabulary instead of deriving from `Stage`',
    ).toEqual([])
  })

  it('POSITIVE + CONTRAST CONTROLS — the sweep sees violations and discriminates consumers', () => {
    // Trap 13 (an absence claim needs a demonstrated presence) and trap 20's
    // corollary (keep a probe whose expected answer DIFFERS — a blind
    // instrument can fake agreement but not a discrimination).
    expect(declaresUiVocabulary(`type S = 'frame' | 'ideate' | 'evaluate' | 'decide' | 'optimise'`)).toBe(true)
    expect(declaresUiVocabulary(`const S = ['ideate', 'evaluate']`)).toBe(true)
    expect(declaresWireVocabulary(`type W = 'frame' | 'analyse' | 'decide' | 'review'`)).toBe(true)

    // A CONSUMER must not be flagged.
    expect(
      declaresUiVocabulary(`if (s === 'ideate') return 1\nif (s === 'evaluate') return 2`),
      'separate comparisons are consumption, not declaration',
    ).toBe(false)
    // A docblock must not be flagged.
    expect(declaresUiVocabulary(`/** 'frame' | 'ideate' | 'optimise' */\nconst x = 1`)).toBe(false)
    // ⭐ THE HOMOGRAPH. `HelpType` is a real declaration in this repo containing
    // `'evaluate'`; it is NOT a stage vocabulary and must never be flagged.
    expect(
      declaresUiVocabulary(`type HelpType = 'clarify' | 'broaden' | 'challenge' | 'evaluate' | 'commit'`),
      'a homograph is not a vocabulary',
    ).toBe(false)
  })

  it('CONTROLS FOR THE COMPARISON-CHAIN SHAPE — the one the first version of this guard missed', () => {
    // ⚠ This block exists because a mutant SURVIVED. Restoring `isStage`'s
    // hand-spelled union left every assertion in this file green: the guard
    // could see a re-declaration written as a LIST and was blind to the same
    // re-declaration written as a `||` CHAIN. A survivor is a claim, and this
    // one was not equivalent — it was the real defect's actual shape.
    expect(
      declaresWireVocabulary(
        `return v === 'frame' || v === 'analyse' || v === 'decide' || v === 'review'`,
      ),
      'the exact pre-fix `isStage` body must be caught',
    ).toBe(true)
    expect(
      declaresUiVocabulary(
        `return s === 'frame' || s === 'ideate' || s === 'evaluate' || s === 'optimise'`,
      ),
    ).toBe(true)

    // CONTRAST — a two-way check is legitimate consumption and must NOT be
    // flagged. This is where the threshold sits, stated so a reader can argue
    // with it rather than discover it.
    expect(
      declaresWireVocabulary(`if (stage === 'analyse' || stage === 'decide') return true`),
      'a two-way stage check is consumption, not a re-declaration',
    ).toBe(false)
    expect(declaresWireVocabulary(`if (stage === 'analyse') return true`)).toBe(false)
  })
})

describe('the ONE edge is TOTAL in both directions', () => {
  const UI_STAGES: readonly ScenarioStage[] = ['frame', 'ideate', 'evaluate', 'decide', 'optimise']

  it('every canonical stage maps to a UI stage', () => {
    // Derived by iterating the CONTRACT, so a member added in a re-vendor REDs
    // here instead of silently returning null into the canvas store — which is
    // a value `scenarios.stage`'s CHECK constraint would reject.
    for (const stage of Stage.options) {
      expect(v5StageToScenarioStage(stage), `no UI stage for canonical \`${stage}\``).not.toBeNull()
    }
  })

  it('every UI stage maps to a canonical stage', () => {
    for (const stage of UI_STAGES) {
      expect(Stage.options).toContain(scenarioStageToV5Stage(stage))
    }
  })

  it('the UI list this file iterates IS the declared type (no third list smuggled in)', () => {
    // ⚠ The two arrays above are the one hand-maintained thing left here, and a
    // hand-maintained list is what this whole file exists to abolish. It cannot
    // be derived — `ScenarioStage` is a TYPE, with no runtime members — so it is
    // pinned instead: each member must round-trip through the edge, which is
    // impossible for a value the edge's `Record<ScenarioStage, …>` does not key.
    // A member added to the type without being added here therefore REDs at the
    // exhaustiveness of that Record, at COMPILE time, not silently at runtime.
    for (const stage of UI_STAGES) {
      const canonical = scenarioStageToV5Stage(stage)
      expect(v5StageToScenarioStage(canonical)).not.toBeNull()
    }
    expect(new Set(UI_STAGES).size, 'duplicate member in the UI list').toBe(UI_STAGES.length)
  })

  it('the mapping is LOSSY in exactly one place, and it is named', () => {
    // `frame` and `ideate` both map to canonical `frame`, so the inverse cannot
    // recover `ideate`. That is a real property of the edge, and pinning it
    // stops a later reader "fixing" the asymmetry into a round-trip the wire
    // cannot support — `ideate` has no canonical counterpart to carry it.
    expect(scenarioStageToV5Stage('frame')).toBe('frame')
    expect(scenarioStageToV5Stage('ideate')).toBe('frame')
    expect(v5StageToScenarioStage('frame')).toBe('frame')
    // Every other UI stage DOES round-trip — the contrast that makes the line
    // above a statement about `ideate` and not about the mapper generally.
    for (const stage of ['evaluate', 'decide', 'optimise'] as const) {
      expect(v5StageToScenarioStage(scenarioStageToV5Stage(stage))).toBe(stage)
    }
  })
})
