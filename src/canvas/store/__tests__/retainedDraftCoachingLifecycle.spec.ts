/**
 * `retainedDraftCoaching` — ITS WHOLE LIFECYCLE, PLUS THE GUARD THAT KEEPS THE
 * RETENTION OFF THE SURFACE THAT CANNOT HOLD IT HONESTLY.
 *
 * THE HARM. `draftCoaching` is a member of `READINESS_CLEAR_FIELDS`, so every
 * analytical edit nulls it. That is the inverse of a stale claim: the user reads
 * "you have framed this narrowly", acts on it by editing the model, and the act
 * itself deletes the sentence that asked for it. Nothing returns it until the next
 * server turn.
 *
 * THE MECHANISM IS #1424's, EXTENDED — not a second one. The admission is
 * harvested at the clear sites into `retainedAnalysisAdmission` and read through
 * `resolveEffectiveAdmission`; coaching is harvested at the same sites into
 * `retainedDraftCoaching` and read through `resolveEffectiveDraftCoaching`. The
 * direction of that resolver is pinned separately in
 * `canvas/domain/__tests__/effectiveDraftCoaching.spec.ts`, because the mutant that
 * inverts it must fail on ITS signature, not on any arm of this file.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES **NOT** CLAIM. It does not claim the other
 * nine members of `READINESS_CLEAR_FIELDS` are retained — they are not, and each
 * refusal is reasoned at `retainedDraftCoaching`'s declaration in `store.ts`. Three
 * are numeric claims about a graph that has since changed, two are structural
 * verdicts the triggering edit can invalidate directly, and three are inputs to a
 * RUN REQUEST rather than to a display. The last arm below pins that the retention
 * set did not quietly grow.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { useCanvasStore } from '../../store'
import type { CEEDraftCoaching } from '../../../adapters/cee/types'

/**
 * ⭐ EVERY `.ts`/`.tsx` UNDER `src/`, NOT ONE FILE.
 *
 * Review B1: the earlier form of the honesty guard counted matches inside
 * `usePreAnalysisModel.ts` alone, and the reviewer MEASURED the hole - it
 * appended a resolver read to `hero/HeroSection.tsx` and the guard stayed
 * green at exit 0. The hazard the PR names is wiring the UNGATED hero slot,
 * and that is reachable from `HeroSection.tsx` or `CoachingSlot.tsx`, neither
 * of which the old pattern could see. The directory is not the surface.
 */
function sourceFilesUnderSrc(): string[] {
  const out: string[] = []
  const stack = [resolve(process.cwd(), 'src')]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__snapshots__') continue
        stack.push(full)
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full)
      }
    }
  }
  return out
}

/** Specs may name the resolver freely; only PRODUCT code is constrained. */
function isSpecFile(path: string): boolean {
  return path.includes('/__tests__/') || /\.(spec|test)\.tsx?$/.test(path)
}

const RESOLVER_DEFINITION = 'src/canvas/domain/effectiveDraftCoaching.ts'
const LIVE_GATED_CONSUMER =
  'src/canvas/components/pre-analysis-v3/hooks/usePreAnalysisModel.ts'

const COACHING: CEEDraftCoaching = {
  summary: 'Two options is a narrow frame for a decision this size.',
  strengthenItems: [],
  wideningLog: [],
  biasSignals: [
    { type: 'narrow_framing', detail: 'You have weighed SMB against Enterprise and nothing else.' },
  ],
}

const FACTOR = {
  id: 'fac_churn',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { kind: 'factor', label: 'Churn rate', observedState: { value: 0.2 } },
}

function seedCoachedDraft() {
  useCanvasStore.setState({
    nodes: [FACTOR],
    edges: [],
    draftCoaching: COACHING,
    retainedDraftCoaching: null,
    ceeAnalysisReady: { status: 'ready', options: [], goal_node_id: 'goal_1' },
  } as never)
}

describe('retainedDraftCoaching lifecycle', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      draftCoaching: null,
      retainedDraftCoaching: null,
      ceeAnalysisReady: null,
    } as never)
  })

  /**
   * ⭐ THE ARM MUTANT (a) MUST KILL. Remove `retainedDraftCoaching` from
   * `readinessClearFields` and this fails on `retainedDraftCoaching`, while every
   * arm of the resolver spec still passes — one mutant, one signature.
   */
  it('a local analytical edit RETAINS the producer’s coaching while nulling readiness', () => {
    seedCoachedDraft()
    // Precondition: nothing retained yet, so what we observe is this edit's doing.
    expect(useCanvasStore.getState().retainedDraftCoaching).toBeNull()

    useCanvasStore.getState().updateNode('fac_churn', {
      data: { observedState: { value: 0.41 } },
    } as never)

    const s = useCanvasStore.getState()
    expect(
      s.draftCoaching,
      'the edit must still clear the LIVE field — this is not a weakening of invalidation',
    ).toBeNull()
    expect(
      s.ceeAnalysisReady,
      'readiness must still go stale, or a real post-edit result would read as current',
    ).toBeNull()
    // Bound by identity: the exact detail string the producer sent, not "some text".
    expect(
      s.retainedDraftCoaching?.biasSignals[0]?.detail,
      'the coaching that asked for the edit must survive the edit',
    ).toBe('You have weighed SMB against Enterprise and nothing else.')
  })

  it('a NON-analytical edit changes nothing — the retention is not a blanket edit hook', () => {
    seedCoachedDraft()
    useCanvasStore.getState().updateNode('fac_churn', { data: { label: 'Churn %' } } as never)
    const s = useCanvasStore.getState()
    expect(s.draftCoaching, 'a label change is not an analytical change').not.toBeNull()
    expect(s.retainedDraftCoaching).toBeNull()
  })

  /**
   * ⭐ THE HAZARD THE FIX INTRODUCES — the same one the retained admission has, and
   * the arm mutant (c) must kill (drop `retainedDraftCoaching` from
   * `DECISION_CONTEXT_CLEAR`). Coaching is prose CEE authored about THIS brief and
   * THIS framing; surviving a full-context replacement would re-word the next
   * decision's signals with the previous decision's guidance.
   */
  it('a decision-context replacement CLEARS it — a previous decision may not coach the next', () => {
    seedCoachedDraft()
    useCanvasStore.getState().updateNode('fac_churn', {
      data: { observedState: { value: 0.41 } },
    } as never)
    // Precondition, bound by IDENTITY rather than by "not null": a non-null check
    // would also be satisfied by some other value arriving in this field, and an
    // `undefined` would slip through it entirely.
    expect(
      useCanvasStore.getState().retainedDraftCoaching?.biasSignals[0]?.detail,
      'precondition: THIS coaching must be retained, or the clear below asserts nothing',
    ).toBe('You have weighed SMB against Enterprise and nothing else.')

    useCanvasStore.getState().resetCanvas()

    expect(
      useCanvasStore.getState().retainedDraftCoaching,
      'the previous decision’s coaching must not ride into the next decision',
    ).toBeNull()
  })

  /**
   * ⭐⭐ THE HONESTY GUARD, DERIVED FROM SOURCE — and it is the one that matters
   * most, because nothing behavioural can see it.
   *
   * Retention is only honest where the CONSUMER is live-gated.
   * `narrowFramingDetail` feeds `sig_option_breadth`'s `ceeOverride`, and that
   * signal re-derives its own firing condition from the live graph
   * (`input.optionCount >= 3` returns null) — so a retained string can re-word a
   * row but never summon one. The hero coaching slot has NO such gate: it renders
   * whenever text exists, beside bars and a ladder that do update live, so a
   * retained summary there is unmarked stale prose.
   *
   * A later lane tidying these two reads into one resolved variable would reopen
   * exactly that, and no behavioural test in this repo would notice. So the claim
   * is asserted structurally: the resolver appears in the model hook EXACTLY once.
   *
   * ⚠ IT PINS ITS OWN PRECONDITION. A guard that read the wrong file, or whose
   * pattern has stopped matching, agrees with every build — so the file's size, the
   * resolver's presence, and the hero memo's live-only read are asserted first.
   */
  it('the retention reaches the live-gated consumer ONLY (derived across ALL of src/)', () => {
    const files = sourceFilesUnderSrc()

    // ── Preconditions on the INSTRUMENT, before any absence is claimed ──────
    // A sweep that reached nothing returns the same clean output as a sweep
    // that looked and found nothing (CLAUDE.md trap 13).
    expect(files.length, 'the walk reached almost nothing - it is not seeing src/').toBeGreaterThan(
      2_000,
    )
    const product = files.filter(f => !isSpecFile(f))
    expect(product.length, 'no product files found - the spec filter has eaten the tree').toBeGreaterThan(
      800,
    )

    let contrastHits = 0
    const callSites: Array<{ file: string; count: number }> = []
    const importers: string[] = []
    for (const file of product) {
      const src = readFileSync(file, 'utf8')
      // Contrast control in the SAME sweep: a symbol we expect PRESENT and
      // widespread. Absence is proven only when the target reads its expected
      // number AND the contrast reads a plausible one.
      if (src.includes('useCanvasStore')) contrastHits += 1
      const rel = file.slice(resolve(process.cwd()).length + 1)
      const count = (src.match(/resolveEffectiveDraftCoaching\(/g) ?? []).length
      if (count > 0) callSites.push({ file: rel, count })
      if (/from ['"][^'"]*effectiveDraftCoaching['"]/.test(src)) importers.push(rel)
    }
    expect(
      contrastHits,
      'contrast control: `useCanvasStore` must be widespread, or this sweep is blind',
    ).toBeGreaterThan(100)

    // ── Precondition 2: the resolver exists, under this name, where we think ─
    const definition = callSites.find(c => c.file === RESOLVER_DEFINITION)
    expect(
      definition,
      'the resolver definition was not found - it was renamed or moved and this guard has ' +
        'stopped discriminating',
    ).toBeDefined()

    // ── THE CLAIM: exactly ONE call site in the whole of src/, and it is the
    //    live-gated one. Not "one inside one file".
    const consumers = callSites.filter(c => c.file !== RESOLVER_DEFINITION)
    expect(
      consumers,
      `resolved reads found at ${JSON.stringify(consumers)}; exactly one is permitted, in ` +
        `${LIVE_GATED_CONSUMER}. The hero coaching slot is UNGATED - it renders whenever text ` +
        `exists - so resolving there would show a retained summary, unmarked, beside live ` +
        `numbers. That needs a visible pre-edit mark first.`,
    ).toEqual([{ file: LIVE_GATED_CONSUMER, count: 1 }])

    // ── And the IMPORTER SET, which is the other way in. A module that imports
    //    the resolver can hand it to anything.
    expect(
      importers,
      'exactly one product module may import the resolver',
    ).toEqual([LIVE_GATED_CONSUMER])

    // And the hero memo still reads the LIVE field alone. Bound to the fallback
    // expression that is unique to that memo, not to a line number.
    const hookSrc = readFileSync(resolve(process.cwd(), LIVE_GATED_CONSUMER), 'utf8')
    expect(
      hookSrc,
      'the hero coaching memo must keep reading draftCoaching directly',
    ).toContain('draftCoaching?.summary?.trim()')
  })

  it('the repo-wide sweep can SEE a resolver read outside the hook (positive control)', () => {
    // The reviewer's own mutant, run as a control rather than described: the
    // guard above claims an absence across src/, so it must be shown capable of
    // reporting a PRESENCE. This runs the same detection over the hero files'
    // real contents with one line appended in memory - nothing is written to
    // disk, so no tree is mutated.
    const heroPath = resolve(
      process.cwd(),
      'src/canvas/components/pre-analysis-v3/hero/HeroSection.tsx',
    )
    const heroSrc = readFileSync(heroPath, 'utf8')
    expect(
      (heroSrc.match(/resolveEffectiveDraftCoaching\(/g) ?? []).length,
      'HeroSection must be clean today, or the control below proves nothing',
    ).toBe(0)
    const mutated = `${heroSrc}\nconst x = resolveEffectiveDraftCoaching(a, b)\n`
    expect(
      (mutated.match(/resolveEffectiveDraftCoaching\(/g) ?? []).length,
      'the detection used by the guard above must fire on a hero-side read',
    ).toBe(1)
  })

  /**
   * ⭐ THE RETENTION SET DID NOT QUIETLY GROW.
   *
   * Nine of the ten cleared fields are deliberately NOT retained, each for a
   * reason recorded at `retainedDraftCoaching`'s declaration: a numeric claim about
   * a graph that has since changed, a structural verdict the triggering edit
   * invalidates, or an input to a run request. A later lane adding one of them to
   * the harvest would be shipping a freshness lie — or, for the request inputs,
   * changing what goes on the wire. This asserts the harvest holds exactly the two
   * retained keys it is supposed to.
   */
  it('readinessClearFields harvests EXACTLY the two retained fields (derived from source)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/canvas/store.ts'), 'utf8')
    expect(src.length, 'the guard did not read store.ts').toBeGreaterThan(10_000)

    const helper = src.match(/function readinessClearFields\(get: \(\) => CanvasState\) \{[\s\S]*?\n\}/)
    expect(helper, 'readinessClearFields was renamed or reshaped — this guard cannot see it').not.toBeNull()
    const body = helper![0]

    // ⭐ REVIEW B2, REPAIRED. This used to read
    //     body.match(/^\s{4}(retained[A-Za-z]+):/gm)
    // and the reviewer MEASURED two evasions: adding
    // `retainedV2Quality: get().ceeQuality ?? null` left it GREEN (a digit is
    // not `[A-Za-z]`), and so did any indentation that is not exactly four
    // spaces. "The retention set cannot quietly grow" was not what it asserted.
    // It now collects EVERY key in the returned literal, whatever it is called
    // and however it is indented, plus the spreads - so a growth of any shape
    // reds. The `retained` prefix is no longer load-bearing.
    const returned = body.match(/return \{([\s\S]*?)\n {2}\}/)
    expect(
      returned,
      'the returned literal could not be located - this guard cannot see the harvest',
    ).not.toBeNull()
    const literal = returned![1]
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')

    const spreads = [...literal.matchAll(/^\s*\.\.\.([A-Za-z_$][A-Za-z0-9_$]*)/gm)].map(m => m[1]).sort()
    expect(
      spreads,
      'the harvest must spread the canonical clear set and nothing else',
    ).toEqual(['READINESS_CLEAR_FIELDS'])

    const harvestedKeys = [...literal.matchAll(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/gm)]
      .map(m => m[1])
      .sort()
    expect(
      harvestedKeys,
      'only the admission, the coaching and the option count that coaching was authored '  +
        'against may be retained across invalidation; every other ' +
        'member of READINESS_CLEAR_FIELDS is either a figure about a superseded graph or an ' +
        'input to a run request. This now counts EVERY key in the literal, so a name with a ' +
        'digit in it, or a different indentation, reds here too.',
    ).toEqual([
      'retainedAnalysisAdmission',
      'retainedDraftCoaching',
      'retainedDraftCoachingOptionCount',
    ])
  })

  /**
   * ⭐ THE DENOMINATOR IS DERIVED, NOT STATED.
   *
   * The change is described as "1 of 10 retained". A prose ratio is a
   * hand-maintained mirror; this reads the canonical set and REDs if a member
   * is added or removed, which is the moment the ratio in the title, the file
   * headers and the review record all go stale at once.
   */
  it('READINESS_CLEAR_FIELDS has exactly ten members (derived from source)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/canvas/store.ts'), 'utf8')
    const block = src.match(/const READINESS_CLEAR_FIELDS = \{([\s\S]*?)\n\} as const/)
    expect(block, 'READINESS_CLEAR_FIELDS was renamed or reshaped').not.toBeNull()
    const members = [
      ...block![1]
        .split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .join('\n')
        .matchAll(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/gm),
    ].map(m => m[1])
    // Positive control: a parse that found nothing would satisfy any count.
    expect(members, 'the parse found no members - it is not reading the literal').toContain(
      'draftCoaching',
    )
    expect(
      members.length,
      'the retention is described as "1 of 10"; that ratio is now derived, and this red means ' +
        'the clear set changed and every statement of the ratio needs re-deriving',
    ).toBe(10)
  })
})
