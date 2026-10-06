/** Item-3 served warnings: the target requirement covers the placeholder subset. */
import { describe, expect, it } from 'vitest'
import {
  GOAL_IDENTITY_WITHHELD_FALLBACK,
  readGoalFigureWithholds,
  readGoalIdentityWithheld,
} from '../goalIdentityWithheld'
import run1 from './fixtures/served-item3-run1-placeholder-target.json'
import run2 from './fixtures/served-item3-run2-placeholder-target.json'

for (const [index, fixture] of [run1, run2].entries()) {
  const warnings = fixture.inference_warnings
  const placeholder = warnings.find((w) => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH')!
  const target = warnings.find((w) => w.code === 'GOAL_FIGURES_TARGET_NOT_TESTABLE')!
  const read = (inference_warnings: unknown[]) => readGoalIdentityWithheld({ inference_warnings })

  describe(`item-3 Run ${index + 1}: complete Goal fit requirement`, () => {
    it('PRECONDITION: the target message is safe and counts the complete requirement', () => {
      expect(placeholder.message.startsWith('Not shown.')).toBe(false)
      expect(target.message.startsWith('Not shown.')).toBe(true)
      expect(target.message.length).toBeLessThanOrEqual(400)
      expect(target.message).toContain(`Receptionist headcount to Monthly booked appointments and ${4 - index} more`)
    })

    it.each(['served', 'reversed', 'duplicated'] as const)('%s mixed warnings show the target message once (RED at base)', (order) => {
      const rows = order === 'reversed' ? [...warnings].reverse() : order === 'duplicated' ? [...warnings, ...warnings] : warnings
      expect(read(rows)?.message).toBe(target.message)
    })

    it('CONTROL: target-only and placeholder-only reads are unchanged', () => {
      expect(read([target])?.message).toBe(target.message)
      expect(read([placeholder])?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
      const safePlaceholder = { ...placeholder, message: 'Not shown. A link needs a size.' }
      expect(read([safePlaceholder])?.message).toBe(safePlaceholder.message)
    })

    it('the complete target replaces even a safe placeholder subset (RED at base)', () => {
      expect(read([{ ...placeholder, message: 'Not shown. A link needs a size.' }, target])?.message).toBe(target.message)
    })

    it('keeps every node ID and every claim/option withhold from the served warnings', () => {
      const expectedIds = [...new Set([...(placeholder.node_ids ?? []), ...(target.node_ids ?? [])])]
      expect(read(warnings)?.nodeIds).toEqual(expectedIds)
      expect(readGoalFigureWithholds({ inference_warnings: warnings })).toEqual([
        ...readGoalFigureWithholds({ inference_warnings: [placeholder] }),
        ...readGoalFigureWithholds({ inference_warnings: [target] }),
      ])
    })

    it('keeps an independent withholding reason beside the complete target (RED at base)', () => {
      const identity = { code: 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED', node_ids: ['other_goal'], message: "Not shown. This run couldn't calculate the goal's formula." }
      expect(read([identity, ...warnings])).toEqual({
        nodeIds: ['other_goal', ...read(warnings)!.nodeIds],
        message: `${identity.message} ${target.message}`,
      })
    })

    it.each([
      undefined,
      '',
      'A link needs a size.',
      `Not shown. ${'x'.repeat(390)}`,
      'Not shown. receptionist_headcount needs a size.',
      'Not shown. <link> needs a size.',
      'Not shown. {link} needs a size.',
      'Not shown. [link] needs a size.',
    ])('CONTROL: unsafe/missing target message %j retains the neutral fallback', (message) => {
      expect(read([placeholder, { ...target, message }])?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
    })

    it('CONTROL: a separate unsafe reason still withholds the entire explanation', () => {
      expect(read([...warnings, { code: 'GOAL_FIGURES_USER_EFFECT_CLAMPED', message: 'Not shown. raw_id was cut.' }])?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
    })
  })
}
