/**
 * ROADMAP 2.1163 / golden-journey EXT-2 — the refusal notice, rendered.
 *
 * `analysis_ready.blocked_reason` had ZERO readers repo-wide. This is the
 * surface that reads it. What the spec pins:
 *
 *  1. no notice in the slice -> renders NOTHING (never claims a refusal);
 *  2. a mapped code -> the past-tense headline + ONE precise reason + the
 *     pointer, and the raw machine code is NEVER user copy;
 *  3. an UNMAPPED code -> the honest generic + the raw code in a details
 *     disclosure — never a fabricated specific;
 *  4. NOT amber "proceed with care" vocabulary (row 2.1127 corrects that
 *     family) and no instruction to a control this surface does not render
 *     (#684 review, D2).
 *
 * Assertions bind by data-testid and by the module's exported copy constants —
 * never by a value predicate another element could satisfy.
 */

import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

import { AnalysisRefusalNotice } from '../AnalysisRefusalNotice'
import {
  ANALYSIS_REFUSAL_HEADLINE,
  ANALYSIS_REFUSAL_GENERIC_REASON,
  ANALYSIS_REFUSAL_POINTER,
  ANALYSIS_REFUSAL_REASON_COPY,
  type AnalysisRefusalNotice as Notice,
} from '../../../canvas/store/analysisRefusalNotice'

const TESTID = 'analysis-refusal-notice'
const RAW_TESTID = 'analysis-refusal-raw-reason'

function notice(blockedReason: string): Notice {
  return { blockedReason, computedAt: '2026-08-14T10:00:00.000Z' }
}

describe('AnalysisRefusalNotice', () => {
  it('renders NOTHING when the slice holds no refusal', () => {
    const { container } = render(<AnalysisRefusalNotice notice={null} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('states the analysis did not run, in the past tense, for a mapped code', () => {
    render(<AnalysisRefusalNotice notice={notice('options_not_configured')} />)

    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(ANALYSIS_REFUSAL_HEADLINE)
    expect(el).toHaveTextContent(
      ANALYSIS_REFUSAL_REASON_COPY.options_not_configured,
    )
    expect(el).toHaveTextContent(ANALYSIS_REFUSAL_POINTER)
    // Identity binding: the code rides on a data attribute for tests/debug.
    expect(el).toHaveAttribute('data-blocked-reason', 'options_not_configured')
    expect(el).toHaveAttribute('data-reason-mapped', 'true')
  })

  it('never shows the raw machine code as user copy when the code is mapped', () => {
    render(<AnalysisRefusalNotice notice={notice('mixed_scale_unresolved')} />)

    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(
      ANALYSIS_REFUSAL_REASON_COPY.mixed_scale_unresolved,
    )
    expect(el).not.toHaveTextContent('mixed_scale_unresolved')
    expect(screen.queryByTestId(RAW_TESTID)).toBeNull()
    // It must not silently substitute the generic for a code it CAN map.
    expect(el).not.toHaveTextContent(ANALYSIS_REFUSAL_GENERIC_REASON)
  })

  it('falls back to the honest generic + a details disclosure for an UNMAPPED code', () => {
    render(<AnalysisRefusalNotice notice={notice('a_brand_new_cee_code')} />)

    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(ANALYSIS_REFUSAL_HEADLINE)
    expect(el).toHaveTextContent(ANALYSIS_REFUSAL_GENERIC_REASON)
    expect(el).toHaveAttribute('data-reason-mapped', 'false')
    // The raw code IS disclosed here — honestly, and only here.
    expect(screen.getByTestId(RAW_TESTID)).toHaveTextContent(
      'a_brand_new_cee_code',
    )
  })

  it('gives the D1 mutation causes the generic, never fabricated analysis copy', () => {
    // CEE turn-executor.ts:8684-8697 removed their reachability on this carrier
    // BY NAME as "a false claim that the ANALYSIS is blocked". If one ever
    // arrives anyway, the notice must not invent a specific analysis cause.
    render(<AnalysisRefusalNotice notice={notice('parameter_invalid_at_execute')} />)

    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(ANALYSIS_REFUSAL_GENERIC_REASON)
    expect(el).toHaveAttribute('data-reason-mapped', 'false')
    expect(screen.getByTestId(RAW_TESTID)).toHaveTextContent(
      'parameter_invalid_at_execute',
    )
  })

  it('is announced politely and is not amber "proceed with care" styling', () => {
    render(<AnalysisRefusalNotice notice={notice('analysis_engine_busy')} />)

    const el = screen.getByTestId(TESTID)
    expect(el).toHaveAttribute('role', 'status')
    // Row 2.1127 is correcting the amber family — this notice must not join it.
    expect(el.className).not.toMatch(/warning/)
    expect(el).not.toHaveTextContent(/proceed with care/i)
  })

  it('never instructs a control this surface does not render (#684 D2)', () => {
    for (const code of Object.keys(ANALYSIS_REFUSAL_REASON_COPY)) {
      const { unmount } = render(<AnalysisRefusalNotice notice={notice(code)} />)
      expect(screen.getByTestId(TESTID)).not.toHaveTextContent(
        /\bclick\b|\bpress\b|\btap\b|\bbutton\b/i,
      )
      // The notice carries no actionable control of its own; CEE owns the
      // recovery chip and it lives in the chat, which the pointer names.
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      unmount()
    }
  })
})
