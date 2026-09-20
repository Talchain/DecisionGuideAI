/**
 * The group's count is what a reader will FIND, not how many ways it is drawn.
 *
 * Witnessed on deployed `219209ad`: "What moves the outcome" advertised **4**
 * while holding two factors — prose rows *Migration and Integration Effort* and
 * *Data Team Capacity*, with the chart's top bar being the FIRST OF THOSE AGAIN.
 * The count was `findings.length + influenceRows.length`, and the view model's
 * own docblock states the two lists are one-to-one ("a row can never appear
 * without its bar"), so that expression double-counts by construction.
 */
import { describe, expect, it } from 'vitest'
import {
  DRIVER_FINDING_ID_PREFIX,
  distinctDriverSubjects,
  driverSubjectKey,
} from '../driverSubjectCount'

const finding = (key: string) => ({ id: `${DRIVER_FINDING_ID_PREFIX}${key}` })
const row = (key: string) => ({ id: key })

describe('driverSubjectKey', () => {
  it('sees through the finding prefix to the factor', () => {
    expect(driverSubjectKey('driver:migration_effort')).toBe('migration_effort')
  })

  it('⭐ DISCRIMINATES: a bare row id is already the subject', () => {
    // Without this the helper could strip blindly and two different factors
    // whose keys merely start with the prefix would collapse into one.
    expect(driverSubjectKey('migration_effort')).toBe('migration_effort')
    expect(driverSubjectKey('driverless_thing')).toBe('driverless_thing')
  })
})

describe('distinctDriverSubjects', () => {
  it('⭐ the witnessed case: two factors drawn twice count TWO, not four', () => {
    const findings = [finding('migration_effort'), finding('data_team_capacity')]
    const rows = [row('migration_effort'), row('data_team_capacity')]
    // PRECONDITION, pinned: the old expression is what shipped, and it is 4.
    expect(findings.length + rows.length).toBe(4)
    expect(distinctDriverSubjects(findings, rows)).toBe(2)
  })

  it('⭐ OPPOSITE-DIRECTION TWIN: genuinely different subjects still add up', () => {
    // Without this, "return 2" or "return findings.length" would satisfy the
    // arm above while destroying the count for any run whose lists diverge.
    const findings = [finding('a'), finding('b')]
    const rows = [row('c')]
    expect(distinctDriverSubjects(findings, rows)).toBe(3)
  })

  it('does not depend on the one-to-one invariant it was written because of', () => {
    // Documented, not enforced. A union grows honestly if it ever breaks.
    expect(distinctDriverSubjects([finding('a')], [])).toBe(1)
    expect(distinctDriverSubjects([], [row('a')])).toBe(1)
    expect(distinctDriverSubjects([], [])).toBe(0)
  })

  it('counts a subject once however many times either list repeats it', () => {
    expect(distinctDriverSubjects([finding('a'), finding('a')], [row('a')])).toBe(1)
  })
})
