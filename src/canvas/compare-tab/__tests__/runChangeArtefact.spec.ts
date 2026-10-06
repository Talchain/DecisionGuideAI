import { describe, expect, it } from 'vitest'
import type { RunDelta } from '@talchain/schemas/boundary'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import {
  INPUTS_NOT_RECORDED_TEXT,
  INPUTS_PARTIAL_TEXT,
  INPUTS_UNCHANGED_TEXT,
  WHATS_CHANGED_FIRST_COMPARISON,
  WHATS_CHANGED_NO_PAIRS,
  noiseQualifier,
} from '../../../components/results/analysisNew/sections/WhatsChanged'
import { buildRunChangeArtefact, type RunChangeArtefactFacts } from '../runChangeArtefact'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

function facts(delta: RunDelta = runChangeDelta()): RunChangeArtefactFacts {
  const label = (id: string) => RUN_CHANGE_LABELS.get(id) ?? null
  return {
    view: buildRunDeltaView(delta, label, label),
    priorRun: delta.endpoints?.prior,
    currentRun: delta.endpoints?.current,
    runIsCurrent: true,
    winSharesWithheld: false,
  }
}

describe('the compact Compare artefact renders the licensed wire facts', () => {
  it('requires both Runs and preserves the stated probabilities in producer order', () => {
    const artefact = buildRunChangeArtefact(facts())!
    expect(artefact.priorRunId).toBe('run-a')
    expect(artefact.currentRunId).toBe('run-b')
    expect(artefact.edits.map(line => line.text)).toEqual(['Pro price, Raise to £60: £59 → £60'])
    expect(artefact.results.map(line => line.text)).toEqual([
      'Raise to £60: supported by 41% → 44% of runs.',
      'Keep £49: supported by 59% → 56% of runs.',
    ])
    expect(artefact.results[1].qualifier).toBe(noiseQualifier('within_noise'))
    expect(artefact.results[0].wireFields).toEqual([
      'run_delta.win_probabilities[].option_id',
      'run_delta.win_probabilities[].prior',
      'run_delta.win_probabilities[].current',
      'run_delta.win_probabilities[].noise_verdict',
    ])
    expect(artefact.edits[0].wireFields).toContain('run_delta.input_changes[].before')
    expect(artefact.edits[0].wireFields).toContain('run_delta.input_changes[].after')
  })

  it.each([
    ['missing prior Run', { priorRun: null }],
    ['missing current Run', { currentRun: undefined }],
    ['absent pair', { view: null }],
    ['stale or unconfirmed result', { runIsCurrent: false }],
    ['unlicensed result', { winSharesWithheld: true }],
  ] satisfies Array<[string, Partial<RunChangeArtefactFacts>]>)('%s produces no artefact', (_name, overrides) => {
    expect(buildRunChangeArtefact({ ...facts(), ...overrides })).toBeNull()
  })

  it('does not turn an edited factor or a comparability case into a named driver', () => {
    const input = facts()
    const artefact = buildRunChangeArtefact(input)!
    expect(artefact.basis.text).toBe(input.view!.comparability)
    expect(artefact.limit!.text).toBe(input.view!.attributionLimit)
    expect(artefact.limit!.text).toBe('Whether a change to the model explains anything below cannot be established from this pair.')
    expect(artefact).not.toHaveProperty('drivers')
    expect(artefact.results.some(line => /price|caused|because|margin|percentage points/i.test(line.text))).toBe(false)
  })

  it('uses a C1 pair verdict verbatim without attributing any particular edit', () => {
    const input = facts(runChangeDelta({
      attribution_case: 'C1_attributable',
      pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
    }))
    const artefact = buildRunChangeArtefact(input)!
    expect(artefact.basis.text).toBe(input.view!.comparability)
    expect(artefact.limit).toBeNull()
    expect(artefact).not.toHaveProperty('drivers')
  })

  it('prints only the producer qualifier when magnitude is not licensed, without deriving direction', () => {
    const artefact = buildRunChangeArtefact(facts(runChangeDelta({
      win_probabilities: [{ option_id: 'opt_60', prior: 0.1, current: 0.9, noise_verdict: 'not_noise_qualified' }],
    })))!
    expect(artefact.results).toEqual([{
      key: 'probability:opt_60',
      text: `Raise to £60: ${noiseQualifier('not_noise_qualified')}`,
      qualifier: null,
      wireFields: ['run_delta.win_probabilities[].option_id', 'run_delta.win_probabilities[].noise_verdict'],
    }])
  })

  it('names the producer leader only on its changed verdict and preserves the noise qualifier', () => {
    // Deliberately not the largest current probability: the client cannot rank a replacement leader.
    const artefact = buildRunChangeArtefact(facts(runChangeDelta({
      leader: {
        changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60',
        noise_verdict: 'not_noise_qualified',
      },
    })))!
    expect(artefact.results[0]).toMatchObject({
      key: 'leader',
      text: 'Highest-scoring option: Keep £49 → Raise to £60.',
      qualifier: noiseQualifier('not_noise_qualified'),
    })
    expect(artefact.results[0].wireFields).toContain('run_delta.leader.changed')
    expect(artefact.results[0].wireFields).toContain('run_delta.leader.current_leading_option_id')
  })

  it.each([
    { changed: false, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60', noise_verdict: 'signal' },
    { changed: true, current_leading_option_id: 'opt_60', noise_verdict: 'signal' },
    { changed: true, prior_leading_option_id: 'opt_49', noise_verdict: 'signal' },
    { changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'unknown', noise_verdict: 'signal' },
  ] satisfies RunDelta['leader'][])('does not infer a leader when the claim or a name is absent: %j', leader => {
    expect(buildRunChangeArtefact(facts(runChangeDelta({ leader })))!.results.some(line => line.key === 'leader')).toBe(false)
  })

  it.each([
    [{ input_coverage: 'complete', input_changes: [] }, INPUTS_UNCHANGED_TEXT],
    [{ input_coverage: 'partial', input_changes: [] }, INPUTS_PARTIAL_TEXT],
    [{ input_coverage: 'not_recorded', input_changes: undefined }, INPUTS_NOT_RECORDED_TEXT],
  ] satisfies Array<[Partial<RunDelta>, string]>)('preserves the input coverage meaning: %j', (overrides, text) => {
    expect(buildRunChangeArtefact(facts(runChangeDelta(overrides)))!.edits.map(line => line.text)).toEqual([text])
  })

  it('keeps a partial-coverage limit even when edits are recorded', () => {
    const artefact = buildRunChangeArtefact(facts(runChangeDelta({ input_coverage: 'partial' })))!
    expect(artefact.edits.map(line => line.text)).toEqual(['Pro price, Raise to £60: £59 → £60', INPUTS_PARTIAL_TEXT])
  })

  it.each([
    [undefined, WHATS_CHANGED_NO_PAIRS],
    ['prior_withheld', WHATS_CHANGED_FIRST_COMPARISON],
    ['no_matched_option', WHATS_CHANGED_NO_PAIRS],
  ] as const)('an empty probability list uses the stated reason %s, never an unchanged result', (reason, text) => {
    const artefact = buildRunChangeArtefact(facts(runChangeDelta({
      win_probabilities: [], win_probabilities_unavailable: reason,
    })))!
    expect(artefact.results.map(line => line.text)).toEqual([text])
  })

  it('keeps the preview small, retaining producer order and directing to the existing detail', () => {
    const delta = runChangeDelta()
    const artefact = buildRunChangeArtefact(facts(runChangeDelta({
      input_changes: ['opt_60', 'opt_49', 'opt_third'].map(option_id => ({ ...delta.input_changes![0], option_id })),
      win_probabilities: [...delta.win_probabilities, { option_id: 'opt_third', prior: 0.1, current: 0.2, noise_verdict: 'signal' }],
    })))!
    expect(artefact.edits).toHaveLength(2)
    expect(artefact.results).toHaveLength(2)
    expect(artefact.moreEdits).toBe(true)
    expect(artefact.moreResults).toBe(true)
  })
})
