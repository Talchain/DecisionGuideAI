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
  MIN_PROD_FILES,
  REPO_ROOT,
  UNDETECTABLE,
  UPDATE_COMMAND,
  compareToBaseline,
  discoverFamilies,
  findReads,
  parseBaseline,
  productionFiles,
  producerAttestation,
  trackedSourceFiles,
  walk,
  type Family,
} from '../claimDrift/claimDriftWalker'

const ROGUE_FIXTURE = join(
  REPO_ROOT,
  'tools',
  'ci-guards',
  '__fixtures__',
  'claim-drift',
  'rogue-consumer.tsx.fixture',
)

describe('claim-ownership drift', () => {
  const all = trackedSourceFiles()
  const prod = productionFiles(all)

  // ── ANTI-VACUITY CONTROLS ─────────────────────────────────────────────────
  // These must fail if the instrument stops seeing anything, rather than the
  // suite passing because it generated nothing to check.

  it('control 1: the scan is not vacuous — it found the production source tree', () => {
    // 1,437 production files at 8b2f5945. A floor, not an equality: the tree grows.
    expect(all.length).toBeGreaterThan(MIN_PROD_FILES)
    expect(prod.length).toBeGreaterThan(MIN_PROD_FILES)
  })

  it('control 2: the scan is not vacuous — at least one family is registered', async () => {
    const families = await discoverFamilies(all)
    expect(
      families.length,
      'ZERO claim families discovered. With passWithNoTests:true a walker that ' +
        'discovers nothing polices nothing and passes green. Either the ' +
        'CLAIM_OWNERSHIP convention was renamed, or every registration was removed.',
    ).toBeGreaterThan(0)
  })

  it('control 3a: every registered raw field has EXACTLY ONE owner', async () => {
    const families = await discoverFamilies(all)
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
    const families = await discoverFamilies(all)
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

  // ── THE WALK ──────────────────────────────────────────────────────────────

  it('no production file re-derives an owned claim beyond the baseline', async () => {
    const families = await discoverFamilies(all)

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

    const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'))
    const { rows, detail } = walk(families, prod)
    const failures = compareToBaseline(rows, baseline, detail, families)

    expect(
      failures.join('\n\n'),
      `\nScope of the absence claim this instrument supports:\n  ${ABSENCE_CLAIM_SCOPE}\n` +
        `It provably does NOT see:\n${UNDETECTABLE.map((u) => `  • ${u}`).join('\n')}\n`,
    ).toBe('')
  })
})
