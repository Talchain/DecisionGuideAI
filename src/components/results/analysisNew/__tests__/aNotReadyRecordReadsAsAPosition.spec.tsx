/**
 * ⭐⭐ "NOT READY TO CHOOSE" IS A POSITION, AND THE READ-BACK NEVER TURNS IT INTO
 * A DECISION (24 Sep 2026).
 *
 * A not-ready record carries no option, no confidence and no expectation. The
 * failure this file exists to catch is the read-back quietly supplying one: the
 * "Decision recorded" heading over a position, an option line printing an id
 * or a remembered label, or a storage sentence saying "your choice" is on the
 * account when there was no choice.
 *
 * ⚠ EVERY ASSERTION BINDS BY TESTID AND BY EXACT COPY CONSTANT. The negative
 * wording sweep runs over the whole section's text, with an option record as
 * its contrast: the same sweep must FIND the option name and "Decision
 * recorded" there, or it proves nothing about the not-ready case.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import {
  DECISION_POSITION_COPY,
  DecisionRecorded,
  recordedOptionText,
  storageSentenceFor,
} from '../sections/DecisionRecorded'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import {
  NOT_READY_POSITION_LABEL,
  type DecisionRecord,
  type NotReadyDecisionRecord,
  type OptionDecisionRecord,
} from '../../modals/decisionRecordStore'

afterEach(cleanup)

const T = 'rec'
const SAVED_AT = Date.UTC(2026, 8, 24, 9, 0, 0)
const REMOTE = {
  recordId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  reviewDate: '2026-12-01T00:00:00.000Z',
  reviewDateSource: 'default_horizon' as const,
}

const NOT_READY: NotReadyDecisionRecord = {
  position: 'not_ready',
  rationale: 'Both options turn on a hiring market we have not sized.',
  assumptionToWatch: 'Senior candidates are available this quarter.',
  revisitTrigger: 'When the hiring market data lands',
  nextAction: 'Size the senior hiring market by Friday.',
  analysisHash: 'run_abc123',
  savedAt: SAVED_AT,
  remote: null,
}

const OPTION: OptionDecisionRecord = {
  optionId: 'opt-a',
  optionLabel: 'Phase the rollout by segment',
  optionNumber: 2,
  confidence: 65,
  expectation: 'churn stays under 4% through Q1',
  rationale: 'It keeps the renewal cohort intact while we learn.',
  assumptionToWatch: 'Enterprise accounts accept usage pricing.',
  revisitTrigger: 'churn crosses 4%',
  analysisHash: 'run_abc123',
  savedAt: SAVED_AT,
  remote: null,
}

const draw = (record: DecisionRecord) =>
  render(<DecisionRecorded isPreRun={false} canCapture record={record} onRecord={vi.fn()} testId={T} />)

/**
 * Every text node in the section, joined with spaces. `textContent` alone runs
 * adjacent rows together ("Decision recordedOption 2"), which would blind a
 * word-boundary sweep in exactly the place a heading meets the next row.
 */
function sectionText(): string {
  const root = screen.getByTestId(T)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const parts: string[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '')
  return `${root.getAttribute('aria-label') ?? ''} ${parts.join(' ')}`
}

/** Words that would make a record read as a choice already made. */
const DECISION_WORDING = /\b(decided|decide[sd]?|chose|chosen|choice|decision recorded)\b/i

describe('a not-ready record reads as a position', () => {
  it('its heading is the position heading, never "Decision recorded"', () => {
    draw(NOT_READY)
    expect(screen.getByTestId(`${T}-title`).textContent).toBe(DECISION_POSITION_COPY.notReadyHeading)
    expect(screen.getByTestId(T)).toHaveAttribute('aria-label', DECISION_POSITION_COPY.notReadyHeading)
  })

  it('prints "Not ready to choose" at the POSITION row, and has no option row at all', () => {
    draw(NOT_READY)
    expect(screen.getByTestId(`${T}-position`).textContent).toBe(NOT_READY_POSITION_LABEL)
    expect(screen.queryByTestId(`${T}-option`)).not.toBeInTheDocument()
  })

  it('renders no confidence and no expectation row: the record carries neither', () => {
    draw(NOT_READY)
    expect(screen.queryByTestId(`${T}-confidence`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`${T}-expectation`)).not.toBeInTheDocument()
  })

  it('⭐ names no option and uses no decision wording anywhere in the section', () => {
    draw(NOT_READY)
    const text = sectionText()
    expect(text).not.toContain(OPTION.optionLabel)
    expect(text).not.toMatch(DECISION_WORDING)
  })

  it('CONTRAST: the same sweep DOES find the option and the decision heading on an option record', () => {
    draw(OPTION)
    const text = sectionText()
    expect(text).toContain(OPTION.optionLabel)
    expect(text).toMatch(DECISION_WORDING)
    expect(screen.queryByTestId(`${T}-position`)).not.toBeInTheDocument()
  })

  it('shows the next action, verbatim, at its own row', () => {
    draw(NOT_READY)
    expect(screen.getByTestId(`${T}-next-action`)).toHaveTextContent(DECISION_POSITION_COPY.nextActionLabel)
    expect(screen.getByTestId(`${T}-next-action`)).toHaveTextContent(NOT_READY.nextAction!)
  })

  it('labels the record as the user’s own view', () => {
    draw(NOT_READY)
    expect(screen.getByTestId(`${T}-your-view`).textContent).toBe(DECISION_POSITION_COPY.yourView)
  })

  it('recordedOptionText gives the position for a not-ready record, never an empty line', () => {
    expect(recordedOptionText(NOT_READY)).toBe(NOT_READY_POSITION_LABEL)
    expect(recordedOptionText(OPTION)).toBe('Option 2: Phase the rollout by segment')
  })
})

describe('the next action row', () => {
  it('renders on an option record that carries one', () => {
    draw({ ...OPTION, nextAction: 'Brief the board on Tuesday.' })
    expect(screen.getByTestId(`${T}-next-action`)).toHaveTextContent('Brief the board on Tuesday.')
  })

  it.each([
    ['absent', undefined],
    ['blank', '   '],
  ])('is withheld when %s', (_label, nextAction) => {
    draw({ ...OPTION, nextAction })
    expect(screen.queryByTestId(`${T}-next-action`)).not.toBeInTheDocument()
  })
})

describe('the storage sentence names only what the account confirmed', () => {
  it('a local not-ready record gets the local sentence, with no cause and no choice', () => {
    expect(storageSentenceFor(NOT_READY)).toBe(COPY.decisionRecord.storedLocal)
  })

  it('a confirmed not-ready record: the position is on the account, the text on this device', () => {
    const sentence = storageSentenceFor({ ...NOT_READY, remote: REMOTE })
    expect(sentence).toBe(DECISION_POSITION_COPY.storedRemoteNotReadyWithNextAction)
    expect(sentence).not.toMatch(/choice|confidence|expectation/i)
  })

  it('without a next action, the not-ready sentence does not name one', () => {
    expect(storageSentenceFor({ ...NOT_READY, nextAction: undefined, remote: REMOTE })).toBe(
      DECISION_POSITION_COPY.storedRemoteNotReady,
    )
  })

  it('an option record keeps TODAY’S sentences when it has no next action (unchanged)', () => {
    expect(storageSentenceFor({ ...OPTION, remote: REMOTE })).toBe(COPY.decisionRecord.storedRemoteWithExpectation)
    expect(storageSentenceFor({ ...OPTION, expectation: undefined, remote: REMOTE })).toBe(COPY.decisionRecord.storedRemote)
  })

  it('an option record WITH a next action names it among the fields on this device', () => {
    expect(storageSentenceFor({ ...OPTION, nextAction: 'Brief the board', remote: REMOTE })).toBe(
      DECISION_POSITION_COPY.storedRemoteWithExpectationAndNextAction,
    )
    expect(storageSentenceFor({ ...OPTION, expectation: undefined, nextAction: 'Brief the board', remote: REMOTE })).toBe(
      DECISION_POSITION_COPY.storedRemoteWithNextAction,
    )
  })

  it('the next-action variants keep the ORIGINAL account half, word for word (no drifting mirror)', () => {
    const accountHalf = (s: string) => s.split('. ')[0]
    expect(accountHalf(DECISION_POSITION_COPY.storedRemoteWithNextAction)).toBe(
      accountHalf(COPY.decisionRecord.storedRemote),
    )
    expect(accountHalf(DECISION_POSITION_COPY.storedRemoteWithExpectationAndNextAction)).toBe(
      accountHalf(COPY.decisionRecord.storedRemoteWithExpectation),
    )
  })

  it('no sentence ever claims the text fields are on the account', () => {
    for (const s of Object.values(DECISION_POSITION_COPY)) {
      expect(s).not.toMatch(/(rationale|assumption|next action|revisit trigger)[^.]*on your account/i)
    }
  })
})
