/**
 * F9 (UI brief 2026-07-16 item 3): the single-live-region rule, extended to
 * run START and SETTLE announcements.
 *
 * `runStatusRegion` already guarantees at most one ONGOING narration region
 * (banner vs slow-run) inside the Analysis tab. F9 adds a dock-level
 * announcer so a run is audible from ANY tab. The extension must keep the
 * one-voice invariant: while the Analysis tab is fronted, its own furniture
 * already speaks (the running banner's narration div at start, the
 * completion toast and error alert at settle), so the announcer must yield
 * there. Everywhere else the announcer is the only voice.
 *
 * These cases pin the pure rule; AnalysisRunAnnouncer.spec.tsx pins the
 * component wiring on top of it.
 */
import { describe, it, expect } from 'vitest'

import * as analysisRunStatus from '../analysisRunStatus'

// Typed indirection keeps this spec compiling RED-first (the export does not
// exist yet); the assertions below fail loudly until it lands.
const runAnnouncementForTransition = (
  analysisRunStatus as unknown as {
    runAnnouncementForTransition?: (input: {
      transition: 'start' | 'settle'
      settledStatus?: string | null
      analysisTabFronted: boolean
    }) => string | null
  }
).runAnnouncementForTransition

describe('F9: runAnnouncementForTransition (one voice per transition)', () => {
  it('is exported from the analysisRunStatus module (the single-live-region rule lives in ONE place)', () => {
    expect(typeof runAnnouncementForTransition).toBe('function')
  })

  it('announces run start when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({ transition: 'start', analysisTabFronted: false }),
    ).toBe('Analysis started.')
  })

  it('yields run start to the Analysis tab furniture when it is fronted (the narration div already speaks)', () => {
    expect(
      runAnnouncementForTransition!({ transition: 'start', analysisTabFronted: true }),
    ).toBeNull()
  })

  it('announces completion when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'complete',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis complete.')
  })

  it('yields settle to the Analysis tab furniture when it is fronted (the completion toast already speaks)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'complete',
        analysisTabFronted: true,
      }),
    ).toBeNull()
  })

  it('announces failure honestly when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'error',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis failed.')
  })

  it('announces cancellation when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'cancelled',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis cancelled.')
  })

  it('says nothing for a settle into an unrecognised or reset status (never fabricate an outcome)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'idle',
        analysisTabFronted: false,
      }),
    ).toBeNull()
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: null,
        analysisTabFronted: false,
      }),
    ).toBeNull()
  })
})
