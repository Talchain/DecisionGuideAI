/**
 * AnalysisHeroV17 — glossary compliance (banned-term scanner, three layers).
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 8:
 * scan
 *   1. Hard-coded strings in v17 hero source files
 *   2. View-model output from buildAnalysisHeroViewModel
 *   3. Post-interpolation rendered DOM text
 *
 * The test-side banned list lives at src/test/glossaryBannedTerms.ts.
 * The production hero has its own narrower fallback check; this scanner
 * is the broader regression net.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { render } from '@testing-library/react'
import {
  findBannedTerm,
  GLOSSARY_BANNED_TERMS,
  HARD_CODED_SOURCE_ALLOWLIST,
} from '../../../../test/glossaryBannedTerms'
import { buildAnalysisHeroViewModel } from '../buildAnalysisHeroViewModel'
import { AnalysisHeroV17 } from '../../AnalysisHeroV17'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { ResultsVM } from '../../types'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  EvidenceGapItem,
  OptionResult,
  FragileEdgeItem,
} from '../../types'

// ── Fixture helper ──────────────────────────────────────────────────────────

function makeData(overrides: {
  winnerLabel?: string
  gapLabels?: string[]
  fragileFromLabel?: string
  fragileAltLabel?: string
  stability?: number
} = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: overrides.winnerLabel ?? 'Option A',
    winProbability: 0.7,
  } as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, { id: 'opt_b', label: 'Option B', winProbability: 0.3 } as OptionResult],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: overrides.stability ?? 0.7,
    coachingReadinessDimensions: { evidence: 0.6, robustness: 0.7, clarity: 0.65 },
  } as DecisionResultData

  const gaps: EvidenceGapItem[] = (overrides.gapLabels ?? []).map((label, i) => ({
    factorId: `n_${i}`,
    factorLabel: label,
    confidence: 60,
    voi: 0.5 - i * 0.1,
    evpiPp: 25,
    targetNodeId: `n_${i}`,
  } as EvidenceGapItem))

  const fragile: FragileEdgeItem | undefined = overrides.fragileFromLabel ? {
    fromId: 'nf',
    fromLabel: overrides.fragileFromLabel,
    toId: 'ny',
    toLabel: 'Outcome',
    switchProbability: 0.42,
    alternativeWinnerLabel: overrides.fragileAltLabel ?? 'Option B',
  } as FragileEdgeItem : undefined

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: gaps,
    topEvidenceGaps: gaps,
    nextActions: [],
    topNextActions: [],
    topFragileEdge: fragile,
  } as ConfidenceSectionData

  return {
    recommendation,
    drivers: { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false },
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false,
    isError: false,
    goalLabel: 'Goal',
  } as ResultsSectionDataReturn
}

function makeVm(): ResultsVM {
  return {
    decisionState: 'robust',
    gapTop2: 0.4,
    hinge: null,
    evidenceLevel: 'fair',
    topAction: null,
    raw: makeData(),
  } as ResultsVM
}

// Default structure + coverage signals: fully complete. Glossary tests
// don't probe the strip values; this keeps each VM call site terse.
const HERO_DEFAULTS = {
  confirmedFactorCount: 0,
  totalFactorCount: 5,
  fragileEdgeCount: 0,
  structureSignals: {
    hasGoal: true, hasMultipleOptions: true, hasFactors: true, hasConnections: true,
  },
  coverageSignals: {
    hasMultipleOptions: true, hasRisks: true, hasBaseline: true, hasGoalThreshold: true,
  },
}

// ── Layer 1: VM output ──────────────────────────────────────────────────────

describe('AnalysisHeroV17 — glossary compliance (VM output)', () => {
  function vmStrings(vm: ReturnType<typeof buildAnalysisHeroViewModel>): string[] {
    const acc: string[] = []
    if (vm.checkedCount) acc.push(vm.checkedCount)
    if (vm.contribution.text) acc.push(vm.contribution.text)
    acc.push(vm.resultLine)
    if (vm.reasonLine) acc.push(vm.reasonLine)
    if (vm.dependencyLine) acc.push(vm.dependencyLine)
    if (vm.keyQuestion) {
      acc.push(vm.keyQuestion.text)
      acc.push(...vm.keyQuestion.extras)
      acc.push(...vm.keyQuestion.chips)
    }
    for (const r of [...vm.inputRows, ...vm.hiddenRows]) {
      acc.push(r.title, r.reason, r.priority, r.chatPrompt)
    }
    vm.alsoLinks.forEach(a => { acc.push(a.label); acc.push(a.chatPrompt) })
    // `footerChecks` + `footerHint` are deprecated (no longer rendered
    // by HeroFooter post 2026-05-21 corrections pass). They remain on
    // the VM with @deprecated JSDoc, but are not user-visible copy and
    // should not be scanned by the user-visible-copy glossary sweep.
    acc.push(vm.footerCta.label, vm.footerCta.chatPrompt)
    return acc
  }

  it('clean fixture → no banned term in any VM string', () => {
    const vm = buildAnalysisHeroViewModel({
      data: makeData({ gapLabels: ['Cost', 'Time'] }),
      vm: makeVm(),
      ...HERO_DEFAULTS,
    })
    for (const s of vmStrings(vm)) {
      const hit = findBannedTerm(s)
      expect(hit, `Banned term "${hit}" found in: "${s}"`).toBeNull()
    }
  })

  it('user-supplied label contains banned term → key question hides on M1 fallback, never amplifies banned label', () => {
    const vm = buildAnalysisHeroViewModel({
      data: makeData({ gapLabels: ['the winning team'] }),
      vm: makeVm(),
      ...HERO_DEFAULTS,
    })
    // Row title preserves the user's label after the Verify prefix
    // (2026-05-21 corrections pass) — we do not rewrite user data, we
    // only prepend a verb.
    expect(vm.inputRows[0].title).toBe('Verify the winning team')
    // No DQP is present in this fixture, so the card is hidden — the
    // templated fallback was removed (2026-05-21). The banned-term-in-label
    // never reaches the key-question text because that path no longer exists.
    expect(vm.keyQuestion).toBeNull()
  })

  it('fragile fromLabel contains banned term → reason line falls back, no leak', () => {
    const vm = buildAnalysisHeroViewModel({
      data: makeData({ fragileFromLabel: 'graph traversal cost' }),
      vm: makeVm(),
      ...HERO_DEFAULTS,
      fragileEdgeCount: 1,
    })
    if (vm.reasonLine) {
      expect(findBannedTerm(vm.reasonLine)).toBeNull()
    }
  })

  it('all four state branches produce banned-term-clean VMs', () => {
    const fixtures = [
      // weak
      { data: makeData({ winnerLabel: undefined, gapLabels: ['A', 'B', 'C', 'D'] }), vmState: 'indeterminate' as const },
      // moderate
      { data: makeData({ gapLabels: ['Cost'] }), vmState: 'sensitive' as const },
      // reflect — bias findings present
      { data: { ...makeData({ stability: 0.7 }), confidence: { ...makeData({ stability: 0.7 }).confidence, m2BiasFindings: [{ type: 'Anchoring', source: 't', description: 'Past spend in brief', affectedElements: [], linkedCritiqueCode: '' }] } } as ResultsSectionDataReturn, vmState: 'robust' as const },
      // strong
      { data: makeData({ stability: 0.9 }), vmState: 'robust' as const },
    ]
    for (const f of fixtures) {
      const vm = buildAnalysisHeroViewModel({
        data: f.data,
        vm: { ...makeVm(), decisionState: f.vmState } as ResultsVM,
        ...HERO_DEFAULTS,
      })
      for (const s of vmStrings(vm)) {
        expect(findBannedTerm(s), `state ${f.vmState}: "${s}"`).toBeNull()
      }
    }
  })
})

// ── Layer 2: Post-interpolation rendered DOM ────────────────────────────────

describe('AnalysisHeroV17 — glossary compliance (rendered DOM)', () => {
  // Per P1.2 round-3 review: the scan covers the ENTIRE rendered v17
  // card — including the composed TriageActionCardsBody when invoked
  // with `useV17Copy` — not just the v17 top subtrees. This way any
  // banned literal that ships in flag-on mode is caught, regardless of
  // whether it originates in v17 components or in the legacy body
  // running in v17-copy mode.

  it('full rendered v17 card carries no banned term across rich fixture', () => {
    const { container } = render(
      <AnalysisHeroV17
        data={makeData({ gapLabels: ['Cost range', 'Time impact', 'Adoption'], fragileFromLabel: 'leadership capacity', fragileAltLabel: 'Two Developers', stability: 0.7 })}
        vm={makeVm()}
        fragileEdgeCount={1}
      />,
    )
    const card = container.querySelector('[data-testid="analysis-hero-v17-card"]')
    expect(card).toBeTruthy()
    const offenders: Array<{ text: string; hit: string }> = []
    const walker = document.createTreeWalker(card!, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = walker.nextNode())) {
      const text = (n as Text).data
      const hit = findBannedTerm(text)
      if (hit) offenders.push({ text, hit })
    }
    expect(offenders, offenders.length
      ? `Banned terms in rendered v17 card:\n` + offenders.map(o => `  "${o.hit}" in "${o.text}"`).join('\n')
      : '',
    ).toEqual([])
  })

  it('strong-state full v17 card (ready row + body contextual blocks) is clean', () => {
    const { container } = render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.9 })}
        vm={{ ...makeVm(), decisionState: 'robust', evidenceLevel: 'good' } as ResultsVM}
        fragileEdgeCount={0}
      />,
    )
    const card = container.querySelector('[data-testid="analysis-hero-v17-card"]')
    const offenders: Array<{ text: string; hit: string }> = []
    const walker = document.createTreeWalker(card!, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = walker.nextNode())) {
      const text = (n as Text).data
      const hit = findBannedTerm(text)
      if (hit) offenders.push({ text, hit })
    }
    expect(offenders).toEqual([])
  })

  it('weak-state full v17 card (no winner, many gaps) is clean', () => {
    const { container } = render(
      <AnalysisHeroV17
        data={{
          ...makeData({ gapLabels: ['A', 'B', 'C', 'D'] }),
          recommendation: { ...makeData().recommendation, recommendedOption: null, allOptions: [] },
        } as ResultsSectionDataReturn}
        vm={{ ...makeVm(), decisionState: 'indeterminate' } as ResultsVM}
        fragileEdgeCount={0}
      />,
    )
    const card = container.querySelector('[data-testid="analysis-hero-v17-card"]')
    const offenders: Array<{ text: string; hit: string }> = []
    const walker = document.createTreeWalker(card!, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = walker.nextNode())) {
      const text = (n as Text).data
      const hit = findBannedTerm(text)
      if (hit) offenders.push({ text, hit })
    }
    expect(offenders).toEqual([])
  })

  it('rendered text never contains user-supplied banned label (label is title-only and never re-templated)', () => {
    const { container } = render(
      <AnalysisHeroV17
        data={makeData({ gapLabels: ['the winning team'] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    // The user's label appears verbatim in the row title — that's correct,
    // we do not rewrite user data. But the templated key question must use
    // the generic fallback ("this factor"), so a deeper text-content scan
    // around the key-question card should not contain "the winning team".
    const kq = container.querySelector('[data-testid="hero-v17-key-question-text"]')
    if (kq) {
      expect(kq.textContent).not.toContain('the winning team')
    }
  })
})

// ── Layer 3: Hard-coded source strings ──────────────────────────────────────

describe('AnalysisHeroV17 — glossary compliance (source files)', () => {
  function* walkSourceFiles(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        if (entry === '__tests__') continue
        yield* walkSourceFiles(fullPath)
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        yield fullPath
      }
    }
  }

  /**
   * Extract user-facing string literals from a TS/TSX source file by
   * matching:
   *   - JSX text children (between > and <)
   *   - Single-quoted, double-quoted, and template-literal strings
   *
   * Skip comments, import statements, console statements, log messages,
   * type-name string literals, JSX attribute internal tokens (className,
   * data-testid, aria-label keys, etc. — those are addressable separately
   * if needed but typically internal).
   *
   * This is a pragmatic best-effort scanner — its goal is to catch
   * regressions where a user-facing string ends up containing a banned
   * term in source.
   */
  function extractCandidateStrings(source: string): string[] {
    const out: string[] = []
    // Remove single-line and block comments first.
    const noComments = source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ')
    // Pull out double-quoted, single-quoted, and template-literal contents.
    const literalRe = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g
    let m: RegExpExecArray | null
    while ((m = literalRe.exec(noComments))) {
      out.push(m[1] ?? m[2] ?? m[3] ?? '')
    }
    // Plus JSX text — content between > and < that isn't whitespace-only.
    const jsxTextRe = />([^<>{]+)</g
    while ((m = jsxTextRe.exec(noComments))) {
      const t = m[1].trim()
      if (t) out.push(t)
    }
    return out
  }

  // Allow-list of EXPLICIT identifier patterns that legitimately appear
  // in v17 hero source as non-user-facing string literals (TypeScript
  // discriminator values, action enum strings, etc.). The list lives in
  // src/test/glossaryBannedTerms.ts so additions require deliberate
  // review. The earlier bare-identifier catchall `/^[a-z][a-z_]*$/i` was
  // removed because it would have masked a future exact banned literal
  // added as a user-facing string. (Per P1 "Improvement: tighten
  // allowlist" review feedback.)
  function isAllowedLiteral(literal: string): boolean {
    return HARD_CODED_SOURCE_ALLOWLIST.some(re => re.test(literal))
  }

  it('no hard-coded user-facing string in v17 hero source files contains a banned term', () => {
    const heroDir = join(__dirname, '..')
    const componentFile = join(__dirname, '..', '..', 'AnalysisHeroV17.tsx')
    const files: string[] = []
    if (existsSync(heroDir)) files.push(...Array.from(walkSourceFiles(heroDir)))
    if (existsSync(componentFile)) files.push(componentFile)

    const offenders: Array<{ file: string; literal: string; hit: string }> = []
    for (const file of files) {
      // Skip test files themselves, and skip the glossaryCheck source —
      // it IS the canonical banned-term list, so by construction it
      // contains every banned term as data.
      if (file.includes('__tests__')) continue
      if (file.endsWith('/glossaryCheck.ts')) continue
      const src = readFileSync(file, 'utf8')
      const literals = extractCandidateStrings(src)
      for (const lit of literals) {
        const hit = findBannedTerm(lit)
        if (hit && !isAllowedLiteral(lit)) {
          offenders.push({ file, literal: lit, hit })
        }
      }
    }
    expect(offenders, offenders.length
      ? `Banned terms found in v17 hero source:\n` + offenders.map(o => `  ${o.file}\n    "${o.literal}" → ${o.hit}`).join('\n')
      : '',
    ).toEqual([])
  })

  it('GLOSSARY_BANNED_TERMS test asset is non-empty and contains canonical entries', () => {
    expect(GLOSSARY_BANNED_TERMS.length).toBeGreaterThan(20)
    expect(GLOSSARY_BANNED_TERMS).toContain('winner')
    expect(GLOSSARY_BANNED_TERMS).toContain('graph')
    expect(GLOSSARY_BANNED_TERMS).toContain('EVPI')
  })
})

// ── Layer 4: Comprehensive iteration — every banned term as a user label ────

/**
 * Per the P1.1 review feedback: production fallback must cover every term
 * in the canonical list. This test sweeps the entire `GLOSSARY_BANNED_TERMS`
 * list, substituting each one as a user-supplied factor label, and asserts
 * that nothing the VM builder generates (chat prompts, key-question text,
 * reason copy) amplifies the banned term. The row TITLE field is allowed
 * to carry the user's verbatim label — we never rewrite user data.
 */
describe('AnalysisHeroV17 — comprehensive banned-term sweep through user labels', () => {
  /**
   * Returns every string field the VM emits — except `inputRows[].title`
   * and `hiddenRows[].title`, which legitimately preserve user labels.
   */
  function generatedCopyOnly(vm: ReturnType<typeof import('../buildAnalysisHeroViewModel').buildAnalysisHeroViewModel>): string[] {
    const acc: string[] = []
    if (vm.checkedCount) acc.push(vm.checkedCount)
    if (vm.contribution.text) acc.push(vm.contribution.text)
    acc.push(vm.resultLine)
    if (vm.reasonLine) acc.push(vm.reasonLine)
    if (vm.dependencyLine) acc.push(vm.dependencyLine)
    if (vm.keyQuestion) {
      acc.push(vm.keyQuestion.text)
      acc.push(...vm.keyQuestion.extras)
      acc.push(...vm.keyQuestion.chips)
    }
    // Skip row.title (user label preserved). Scan reason + chatPrompt only.
    for (const r of [...vm.inputRows, ...vm.hiddenRows]) {
      acc.push(r.reason, r.priority, r.chatPrompt)
    }
    vm.alsoLinks.forEach(a => { acc.push(a.label); acc.push(a.chatPrompt) })
    // `footerChecks` + `footerHint` are deprecated (no longer rendered
    // post 2026-05-21 corrections pass) — see the parallel helper above
    // for the same skip.
    acc.push(vm.footerCta.label, vm.footerCta.chatPrompt)
    return acc
  }

  it.each(GLOSSARY_BANNED_TERMS as readonly string[])(
    'banned term "%s" never amplified into generated copy when used as a factor label',
    (term) => {
      // Insert the banned term inside a realistic factor label, then build
      // a VM that has this row at rank 1 (so the key question + footer CTA
      // template would interpolate it if the production gate failed).
      const factorLabel = `${term} as a factor`
      const data = makeData({ gapLabels: [factorLabel] })
      const vm = buildAnalysisHeroViewModel({
        data,
        vm: makeVm(),
        ...HERO_DEFAULTS,
      })

      // Row title preserves the user's label verbatim AFTER the verb
      // prefix (2026-05-21 corrections pass): risk/evidence/causal rows
      // are prepended with "Verify ". We never rewrite the user's label,
      // we only prepend a verb. The user-data preservation guarantee is
      // unchanged — the factor label still flows through unchanged as the
      // suffix of the title.
      expect(vm.inputRows[0].title).toBe(`Verify ${factorLabel}`)
      expect(vm.inputRows[0].title.endsWith(factorLabel)).toBe(true)

      // But every piece of GENERATED copy must be clean of the banned term.
      const offenders: Array<{ field: string; text: string }> = []
      for (const line of generatedCopyOnly(vm)) {
        const hit = findBannedTerm(line)
        if (hit) offenders.push({ field: hit, text: line })
      }
      expect(offenders, offenders.length
        ? `Banned term "${term}" leaked into generated copy:\n` + offenders.map(o => `  ${o.field}: "${o.text}"`).join('\n')
        : '',
      ).toEqual([])
    },
  )

  it('fragile-edge fromLabel sweep: every banned term substituted as the fragile factor name is also gated', () => {
    const offenders: Array<{ term: string; text: string }> = []
    for (const term of GLOSSARY_BANNED_TERMS as readonly string[]) {
      const fromLabel = `the ${term} factor`
      const data = makeData({ fragileFromLabel: fromLabel })
      const vm = buildAnalysisHeroViewModel({
        data,
        vm: makeVm(),
        ...HERO_DEFAULTS,
        fragileEdgeCount: 1,
      })
      // Reason line interpolates `fromLabel` only via safeInterpolatedLabel.
      if (vm.reasonLine) {
        const hit = findBannedTerm(vm.reasonLine)
        if (hit) offenders.push({ term, text: vm.reasonLine })
      }
    }
    expect(offenders, offenders.length
      ? `Banned terms leaked via fragile fromLabel:\n` + offenders.map(o => `  [${o.term}] "${o.text}"`).join('\n')
      : '',
    ).toEqual([])
  })

  it('row chatPrompt sweep: every banned term substituted as a row title is gated', () => {
    const offenders: Array<{ term: string; prompt: string }> = []
    for (const term of GLOSSARY_BANNED_TERMS as readonly string[]) {
      const factorLabel = `the ${term} factor`
      const data = makeData({ gapLabels: [factorLabel] })
      const vm = buildAnalysisHeroViewModel({
        data,
        vm: makeVm(),
        ...HERO_DEFAULTS,
      })
      const row = vm.inputRows[0]
      if (!row) continue
      const hit = findBannedTerm(row.chatPrompt)
      if (hit) offenders.push({ term, prompt: row.chatPrompt })
    }
    expect(offenders, offenders.length
      ? `Row chatPrompts leaked banned terms:\n` + offenders.map(o => `  [${o.term}] "${o.prompt}"`).join('\n')
      : '',
    ).toEqual([])
  })
})
