/**
 * Claim-ownership drift walker — ONE instrument, ALL families.
 *
 * Families are DISCOVERED, never listed: any module exporting `CLAIM_OWNERSHIP`
 * registers itself and the raw producer fields it owns, and this spec globs
 * `git ls-files` to find them and DYNAMICALLY IMPORTS them to read the real
 * runtime value. Adding a family is adding a selector — there is no list to
 * bump here, and none in the ESLint config either. That is the whole point: the
 * predecessor instrument (`no-raw-influence-read.spec.ts`) hand-lists its family
 * in two files, which is the hand-maintained-mirror defect class, which is the
 * one that drifts silently.
 *
 * Engine (pure functions, shared with the baseline generator so the gate and the
 * generator cannot disagree): `src/test/claimDrift/claimDriftWalker.ts`.
 * What the instrument CANNOT see: `UNDETECTABLE` / `ABSENCE_CLAIM_SCOPE` there.
 *
 * ⚠ THE ANTI-VACUITY CONTROLS BELOW ARE NOT BOILERPLATE. `vitest.config.ts`
 * sets `passWithNoTests: true`. If discovery silently yields zero families — a
 * glob typo, a renamed convention, a `git ls-files` that returns nothing — a
 * naive walker generates no assertions and CI goes GREEN. That is the exact
 * shape of this programme's dominant defect class, aimed squarely at the
 * instrument built to prevent it. Three controls exist for it and every one of
 * them lives OUTSIDE the discovered-family loop:
 *   1. a production-source-file floor,
 *   2. a families-found floor,
 *   3. one-owner-per-field, plus the output-name collision check.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  ABSENCE_CLAIM_SCOPE,
  BASELINE_PATH,
  IDENTITIES_PATH,
  MIN_PROD_FILES,
  REPO_ROOT,
  UNDETECTABLE,
  UPDATE_COMMAND,
  aggregateItems,
  compareIdentities,
  compareToBaseline,
  createSourceCache,
  crossCheckArtefacts,
  discoverFamilies,
  findReads,
  parseBaseline,
  parseIdentities,
  productionFiles,
  producerAttestation,
  renderBaseline,
  renderIdentities,
  trackedSourceFiles,
  walk,
  type Family,
  type Item,
  type Row,
} from '../claimDrift/claimDriftWalker'

const FIXTURES = join(REPO_ROOT, 'tools', 'ci-guards', '__fixtures__', 'claim-drift')
const ROGUE_FIXTURE = join(FIXTURES, 'rogue-consumer.tsx.fixture')

describe('claim-ownership drift', () => {
  const all = trackedSourceFiles()
  const prod = productionFiles(all)

  // ONE scan of the tree for the whole file, shared by discovery and the walk.
  // Discovery reads every tracked file; the walk reads the production subset, so
  // without this the same bytes are read repeatedly. Measured at 6d474415, the
  // four `discoverFamilies` calls below cost 11,008 of the run's 13,890
  // `readFileSync` calls — the same 2,752 files, four times, for an answer that
  // cannot differ between them inside one spec run.
  const sources = createSourceCache()

  // LAZY, not eager. Building the promise here in the describe body would create
  // it at COLLECTION time, and a discovery failure — which this instrument goes
  // out of its way to make loud — would surface as an unhandled rejection with
  // no test attached to it. Created on first use instead, so the rejection always
  // has an awaiter and every test that asks for the families still fails with the
  // real message, exactly as when each called `discoverFamilies` itself.
  let familiesOnce: Promise<Family[]> | null = null
  const discoveredFamilies = (): Promise<Family[]> =>
    (familiesOnce ??= discoverFamilies(all, sources))

  // ── ANTI-VACUITY CONTROLS ─────────────────────────────────────────────────
  // These must fail if the instrument stops seeing anything, rather than the
  // suite passing because it generated nothing to check.

  it('control 1: the scan is not vacuous — it found the production source tree', () => {
    // 1,437 production files at 8b2f5945. A floor, not an equality: the tree grows.
    expect(all.length).toBeGreaterThan(MIN_PROD_FILES)
    expect(prod.length).toBeGreaterThan(MIN_PROD_FILES)
  })

  it('control 2: the scan is not vacuous — at least one family is registered', async () => {
    const families = await discoveredFamilies()
    expect(
      families.length,
      'ZERO claim families discovered. With passWithNoTests:true a walker that ' +
        'discovers nothing polices nothing and passes green. Either the ' +
        'CLAIM_OWNERSHIP convention was renamed, or every registration was removed.',
    ).toBeGreaterThan(0)
  })

  it('control 3a: every registered raw field has EXACTLY ONE owner', async () => {
    const families = await discoveredFamilies()
    const fieldOwner = new Map<string, string>()
    const familyOwner = new Map<string, string>()
    const clashes: string[] = []
    for (const f of families) {
      const prevFamily = familyOwner.get(f.family)
      if (prevFamily) clashes.push(`family "${f.family}" registered by BOTH ${prevFamily} and ${f.ownerRel}`)
      else familyOwner.set(f.family, f.ownerRel)
      for (const field of f.rawFields) {
        const prev = fieldOwner.get(field)
        if (prev) clashes.push(`raw field "${field}" claimed by BOTH ${prev} and ${f.ownerRel}`)
        else fieldOwner.set(field, f.ownerRel)
      }
    }
    // Two choosers for one claim IS the defect. PR #496 repaired exactly this by
    // hand (useNodeDisplayMetadata was a second, divergent goal-probability
    // chooser); the same class shipped twice as the `generateGraphHash` twins.
    expect(clashes).toEqual([])
  })

  it('control 3b: no registered raw field collides with its own owner’s OUTPUT field', async () => {
    // The design lane’s own self-correction, pinned. Registering `goalProbability`
    // — which is also `GoalProbabilitySelection.goalProbability`, the selector’s
    // OWN output — measures 23 violator files / 60 hits, of which ~14 files are
    // CORRECT code reading the selector’s output. A name-based scanner cannot
    // tell "raw producer alias" from "the owner’s own output property" when they
    // share a name, so the naive alias fix punishes exactly the sites a migration
    // just made compliant. The owner’s output surface is DERIVED here (by
    // calling the selector), never declared, so this cannot rot.
    const families = await discoveredFamilies()
    const collisions: string[] = []
    for (const f of families) {
      for (const field of f.rawFields) {
        if (f.outputFields.includes(field)) {
          collisions.push(
            `${f.ownerRel}: rawField "${field}" is also a key of ${f.callInstead}()’s return ` +
              `type — rename the output field or drop the alias. Registering it would redden ` +
              `every correct consumer that reads the selector’s output.`,
          )
        }
      }
    }
    expect(collisions).toEqual([])
  })

  // ── DETECTOR CONTRACT ─────────────────────────────────────────────────────
  // An absence assertion must first prove it can see a PRESENCE (trap 13). The
  // fixture strings are PINNED LITERALS, never derived from the live
  // CLAIM_OWNERSHIP — a control pinned to "whatever is registered now" is
  // hollowed out the moment a field is renamed, and would then pass by testing
  // nothing (trap 12b).

  const PINNED = 'goal_probability'
  const PINNED_ALIAS = 'probability_of_joint_goal'
  const pinnedFamily: Family = {
    family: 'pinned-detector-contract',
    rawFields: [PINNED, PINNED_ALIAS],
    callInstead: 'selectGoalProbability',
    ownerRel: 'src/does/not/exist.ts',
    outputFields: [],
  }

  it('detector contract: the rogue fixture exists and pins LITERAL field names', () => {
    expect(existsSync(ROGUE_FIXTURE)).toBe(true)
    const src = readFileSync(ROGUE_FIXTURE, 'utf8')
    // Literal, by design — NOT read from the live registration.
    expect(src).toContain(PINNED)
    expect(src).toContain(PINNED_ALIAS)
  })

  it('detector contract: it CATCHES all four shapes, incl. the 5-of-9 family-1 evasions', () => {
    const cases: Array<[string, string]> = [
      ['plain member read', 'const v = prob.goal_probability'],
      ['optional member read', 'const v = prob?.goal_probability'],
      ['plain destructure', 'const { goal_probability } = prob'],
      ['RENAMED destructure', 'const { goal_probability: g } = prob'],
      ['renamed destructure w/ default', 'const { probability_of_joint_goal: n = 0 } = prob'],
      ['nested destructure in params', 'function f({ goal_probability: s }) { return s }'],
      ['computed access, single quotes', "const v = prob['goal_probability']"],
      ['computed access, double quotes', 'const v = prob["probability_of_joint_goal"]'],
      ['computed access, template', 'const v = prob[`goal_probability`]'],
      ['template interpolation', 'const s = `${prob.goal_probability}`'],
    ]
    const missed = cases.filter(([, code]) => findReads(code, 'x.ts', pinnedFamily).length === 0)
    expect(missed.map(([name]) => name)).toEqual([])
  })

  it('detector contract: it does NOT fire on comments, or on a sanctioned chain', () => {
    const green: Array<[string, string]> = [
      ['line comment', '// const v = prob.goal_probability'],
      ['block comment', '/* prob.goal_probability */'],
      ['sanctioned same-line chain', 'const v = selectGoalProbability(prob).goalProbability ?? prob.goal_probability'],
      ['presence probe', "if (typeof prob.goal_probability === 'number') {}"],
      ['unrelated field', 'const v = prob.win_probability'],
    ]
    const falseReds = green.filter(([, code]) => findReads(code, 'x.ts', pinnedFamily).length > 0)
    expect(falseReds.map(([name]) => name)).toEqual([])
  })

  it('detector contract: object CONSTRUCTION and multi-member type declarations are not reads', () => {
    // ⚠ Refinement of the design, measured: widening the destructure class to a
    // bare `[,}:=]` (as the design proposed) matches `{ field: <expr> }`, which
    // is how producers WRITE the field out and how inline types DECLARE it —
    // neither is a read. Pinned so the narrowing cannot be silently undone.
    const notReads = [
      '        ? { goal_probability: safeFiniteNumber(enriched?.probability_of_goal) }',
      '  optionProbabilities: Record<string, { goal_probability: number; confidence?: number }> | undefined,',
      '    option_probabilities?: Record<string, { goal_probability: number; confidence: number }>',
    ]
    const construction = { ...pinnedFamily, rawFields: [PINNED] }
    // The first line DOES contain a real member read (`enriched?.probability_of_goal`)
    // — it is only the `{ goal_probability: … }` half that must not count. So
    // check with a field set that excludes the alias.
    const fired = notReads.filter((code) => findReads(code, 'x.ts', construction).length > 0)
    expect(fired).toEqual([])
  })

  it('detector contract: a producer attestation needs a real rationale, not a bare marker', () => {
    expect(producerAttestation('/** @claim-producer goal-probability */', 'goal-probability')).toBeNull()
    const real =
      '/**\n * @claim-producer goal-probability\n * @rationale This is the wire boundary where the ' +
      'field enters the UI; it creates the field rather than choosing a displayed claim from it.\n */'
    expect(producerAttestation(real, 'goal-probability')).not.toBeNull()
  })

  it('detector contract: one family cannot inherit another family’s attestation by prefix', () => {
    // Family names contain hyphens, so a `\b` boundary would let an attestation
    // for `goal-probability-v2` silently exempt `goal-probability` as well.
    const v2 =
      '/**\n * @claim-producer goal-probability-v2\n * @rationale A different family entirely, whose ' +
      'name merely begins with the same characters as the one above it.\n */'
    expect(producerAttestation(v2, 'goal-probability-v2')).not.toBeNull()
    expect(producerAttestation(v2, 'goal-probability')).toBeNull()
  })

  // ── THE WITHIN-FILE SWAP CONTROLS, AND THEIR MUTANTS ──────────────────────
  //
  // #506 found two defects in scripts/ci/typecheck-gate.sh, the gate whose
  // ratchet rules this instrument copied while calling it already-reviewed.
  // Defect 1 (dedup on rendered text) is not inherited: nothing here
  // deduplicates, and the row identity is (family, path). Defect 2 IS
  // inherited — a fix-one-add-one inside one already-baselined file moves no
  // per-file count. Measured by injection against the real gate at 13cca490:
  // both swap shapes below left every row identical and the suite GREEN.
  //
  // These controls drive the SAME functions the gate and the generator use —
  // findReads, renderIdentities/parseIdentities, compareIdentities,
  // renderBaseline/parseBaseline — never a local re-implementation of them.
  // Each is followed by a MUTANT that collapses the one dimension the control
  // depends on, and asserts the control goes quiet. Without that, a control
  // that reds for some incidental reason reads exactly like a control that
  // works (trap 13).

  const SWAP_REL = 'src/fixture/swapControl.ts'
  const swapFamily: Family = {
    family: 'swap-control',
    rawFields: ['elasticity', 'sensitivity_score'],
    callInstead: null,
    debtReason:
      'Pinned control family for the within-file swap ratchet; owns nothing and is never discovered.',
    ownerRel: 'src/does/not/exist.ts',
    outputFields: [],
  }

  /** Walk one pinned fixture exactly as `walk()` would, and return both views. */
  const stateOf = (fixture: string): { rows: Row[]; items: Item[] } => {
    const hits = findReads(readFileSync(join(FIXTURES, fixture), 'utf8'), SWAP_REL, swapFamily)
    return {
      rows: [{ family: swapFamily.family, rel: SWAP_REL, count: hits.length, exempt: false }],
      items: hits.map((h) => ({
        family: swapFamily.family,
        rel: SWAP_REL,
        field: h.field,
        text: h.text,
      })),
    }
  }
  /** Round-trip through the real serialisers, so the control cannot diverge. */
  const asBaseline = (rows: Row[]) => parseBaseline(renderBaseline(rows))
  const asIdentities = (items: Item[]) => parseIdentities(renderIdentities(items))
  const fields = (items: Item[]) => items.map((i) => i.field).sort()
  const texts = (items: Item[]) => items.map((i) => i.text).sort()

  const before = stateOf('swap-before.ts.fixture')
  const diffField = stateOf('swap-different-field.ts.fixture')
  const sameField = stateOf('swap-same-field.ts.fixture')

  it('control: the fixtures really are SWAPS — same per-file count, different reads', () => {
    // If this drifts, every assertion below is testing something else.
    expect(before.items.length).toBe(2)
    expect(diffField.rows[0].count).toBe(before.rows[0].count)
    expect(sameField.rows[0].count).toBe(before.rows[0].count)
    expect(fields(diffField.items)).not.toEqual(fields(before.items))
    expect(fields(sameField.items)).toEqual(fields(before.items))
    expect(texts(sameField.items)).not.toEqual(texts(before.items))
  })

  it('control: the PER-FILE count ratchet is SILENT on both swaps — the hole, asserted', () => {
    // Not "we believe it cannot see this". It is run, and it says nothing.
    for (const after of [diffField, sameField]) {
      expect(
        compareToBaseline(after.rows, asBaseline(before.rows), new Map(), [swapFamily]),
      ).toEqual([])
    }
  })

  it('control: a DIFFERENT-field within-file swap is BLOCKED by the identities ratchet', () => {
    const { failures } = compareIdentities(diffField.items, asIdentities(before.items))
    expect(failures).not.toEqual([])
    // It must red for the right reason: the field buckets moved, both ways.
    expect(failures.join('\n')).toMatch(/MORE reads of one field[^]*sensitivity_score/)
    expect(failures.join('\n')).toMatch(/STALE raw-read field[^]*elasticity/)
  })

  it('MUTANT: collapse the FIELD dimension and that control goes quiet', () => {
    // Same two states, every field forced to one value. If the red above came
    // from anything other than the per-field bucket, it would survive this.
    const flat = (items: Item[]): Item[] => items.map((i) => ({ ...i, field: 'ONE_BUCKET' }))
    expect(compareIdentities(flat(diffField.items), asIdentities(flat(before.items))).failures).toEqual(
      [],
    )
  })

  it('control: a SAME-field within-file swap blocks NOTHING, and is REPORTED', () => {
    const { failures, notices } = compareIdentities(sameField.items, asIdentities(before.items))
    // The declared limit, pinned so it cannot be quietly overclaimed again.
    expect(failures).toEqual([])
    // ...but it is not invisible: exactly one identity out, one in.
    expect(notices.filter((n) => n.startsWith('+'))).toHaveLength(1)
    expect(notices.filter((n) => n.startsWith('-'))).toHaveLength(1)
    expect(notices.join('\n')).toMatch(/elasticity/)
  })

  it('MUTANT: collapse the TEXT dimension and that report goes quiet', () => {
    // The report's whole discriminating power is the source text. Collapse it
    // to a constant and a same-field swap becomes literally unobservable —
    // which is the state this instrument was in before this PR, stated as a
    // mutant rather than as a claim.
    const elide = (items: Item[]): Item[] => items.map((i) => ({ ...i, text: 'TEXT_ELIDED' }))
    const { failures, notices } = compareIdentities(
      elide(sameField.items),
      asIdentities(elide(before.items)),
    )
    expect(failures).toEqual([])
    expect(notices).toEqual([])
    // And the artefact cannot be muted by hand either: a row with an EMPTY text
    // column would disable the report for that read, so it is rejected outright
    // rather than parsed into a silent blind spot.
    const withEmptyText = renderIdentities(before.items).replace(/\t[^\t\n]+$/m, '\t')
    expect(() => parseIdentities(withEmptyText)).toThrow(/Malformed identities row/)
  })

  it('control: the two artefacts must AGREE, and say so loudly when they do not', () => {
    // Consistent pair: silent.
    expect(crossCheckArtefacts(before.rows, aggregateItems(before.items))).toEqual([])
    // Skewed pair — the shape a half-run generator or a hand edit produces.
    const skewed: Row[] = [{ ...before.rows[0], count: before.rows[0].count + 1 }]
    expect(crossCheckArtefacts(skewed, aggregateItems(before.items))).not.toEqual([])
  })

  it('control: the item artefact is byte-stable under input order — no phantom diffs', () => {
    // #506's Fix 1 in its general form: an artefact whose bytes depend on
    // anything but the facts it records will diff for no reason, and a diff
    // with no defect behind it teaches people to regenerate without reading.
    // Walk order is a `git ls-files` implementation detail; the file must not
    // encode it.
    const shuffled = [...before.items, ...diffField.items].sort(() => 0.5 - Math.random())
    const a = renderIdentities(shuffled)
    const b = renderIdentities([...shuffled].reverse())
    expect(a).toBe(b)
  })

  it('control: duplicate reads are COUNTED, never de-duplicated', () => {
    // The direction matters. #506 found one diagnostic baselined TWICE by a
    // `sort -u` over unstable text; the opposite error — collapsing two real
    // reads into one — would silently license the second. Two identical lines
    // are two reads, and the artefact says 2.
    const twice: Item[] = [before.items[0], { ...before.items[0] }]
    const rows = aggregateItems(twice)
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(2)
    expect(parseIdentities(renderIdentities(twice)).declaredCount).toBe(2)
  })

  it('control: neither artefact accepts a hand-edited total', () => {
    const bumpHeader = (text: string, name: string) =>
      text.replace(new RegExp(`# ${name}=\\d+`), `# ${name}=999`)
    expect(() => parseBaseline(bumpHeader(renderBaseline(before.rows), 'count'))).toThrow(
      /internally inconsistent/,
    )
    expect(() => parseIdentities(bumpHeader(renderIdentities(before.items), 'count'))).toThrow(
      /internally inconsistent/,
    )
  })

  // ── THE WALK ──────────────────────────────────────────────────────────────

  it('no production file re-derives an owned claim beyond the baseline', async () => {
    const families = await discoveredFamilies()

    // Per-family floor. A family whose fields vanish from the tree entirely is
    // either fully migrated (regenerate: the stale rows will say so) or the
    // registration has drifted from reality — both must be visible, never a
    // silent zero.
    for (const fam of families) {
      expect(fam.rawFields.length, `family "${fam.family}" registered no fields`).toBeGreaterThan(0)
    }

    expect(
      existsSync(BASELINE_PATH),
      `Missing baseline: ${BASELINE_PATH}. Generate it with \`${UPDATE_COMMAND}\`.`,
    ).toBe(true)

    expect(
      existsSync(IDENTITIES_PATH),
      `Missing item baseline: ${IDENTITIES_PATH}. Generate it with \`${UPDATE_COMMAND}\`.`,
    ).toBe(true)

    const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'))
    const identities = parseIdentities(readFileSync(IDENTITIES_PATH, 'utf8'))
    const { rows, detail, items } = walk(families, prod, sources)

    // The pair must agree before either is trusted. A skew means one artefact
    // was hand-edited or a generator half-ran, and a baseline that disagrees
    // with its own detail is the green-lie shape both files exist to prevent.
    expect(
      crossCheckArtefacts(baseline.rows, identities.rows).join('\n'),
      'claim-drift-baseline.tsv and claim-drift-identities.tsv disagree. They are ' +
        `generated in one pass; regenerate both with \`${UPDATE_COMMAND}\`.`,
    ).toBe('')

    const failures = compareToBaseline(rows, baseline, detail, families)
    const { failures: idFailures, notices } = compareIdentities(items, identities)

    // NON-BLOCKING, by design and for #506's reason: the identity carries source
    // TEXT, text moves under reformatting, and a heuristic belongs where its
    // drift costs noise in a report rather than a red build. This print is the
    // ONLY place a same-field within-file swap becomes visible.
    if (notices.length > 0) {
      console.log(
        `\n[claim-drift] ${notices.length} raw-read identity change(s) — reported, not blocking:\n` +
          notices.map((n) => `  ${n}`).join('\n') +
          (failures.length === 0 && idFailures.length === 0
            ? '\n  ⚠ every count ratchet is GREEN while the item set moved: this is a\n' +
              '    WITHIN-FILE SWAP. No count can see one. Read the rows above.\n'
            : '\n'),
      )
    }

    expect(
      [...failures, ...idFailures].join('\n\n'),
      `\nScope of the absence claim this instrument supports:\n  ${ABSENCE_CLAIM_SCOPE}\n` +
        `It provably does NOT see:\n${UNDETECTABLE.map((u) => `  • ${u}`).join('\n')}\n`,
    ).toBe('')
  })
})
