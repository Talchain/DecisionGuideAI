/**
 * runReturnSignal — decision table for the ROADMAP 2.204 post-run return.
 *
 * The component-level pins live in OutputsDock.runReturnsToOlumi.spec.tsx (they
 * prove the dock is WIRED to this decision). This file proves the decision
 * itself, exhaustively and cheaply: one positive case, then EVERY input flipped
 * individually against it.
 *
 * Why the per-input negatives are the point. `shouldReturnToOlumiAfterRun` is a
 * six-way conjunction, and a conjunction is the easiest shape in which to ship a
 * gate that never binds: drop any `&&` and the function still returns `true` for
 * the happy path, so a test that only checks the happy path passes against a
 * gate that has been deleted. Each `it` below is the named mutant for one
 * clause — remove that clause from the implementation and exactly that test
 * goes red.
 */

import { describe, it, expect } from 'vitest'
import type { ConversationMessage } from '../../conversation/types'
import {
  countAnalysisReviewBlocks,
  shouldReturnToOlumiAfterRun,
  type RunReturnSignalInput,
} from '../runReturnSignal'

function message(id: string, blocks?: unknown[]): ConversationMessage {
  return {
    id,
    role: 'assistant',
    content: 'text',
    timestamp: new Date(),
    ...(blocks ? { blocks } : {}),
  } as ConversationMessage
}

const analysisBlock = {
  type: 'v5_analysis_result',
  summary: 'Option A leads.',
  leading_option_id: 'opt-a',
}
const coachingBlock = { type: 'v5_coaching', coaching_kind: 'strengthen', body: 'x' }
const reviewCardBlock = { type: 'v5_review_card', card_kind: 'pre_mortem', body: 'y' }

describe('countAnalysisReviewBlocks', () => {
  it('is 0 for no conversation at all (undefined / null / empty)', () => {
    expect(countAnalysisReviewBlocks(undefined)).toBe(0)
    expect(countAnalysisReviewBlocks(null)).toBe(0)
    expect(countAnalysisReviewBlocks([])).toBe(0)
  })

  it('is 0 for messages that carry no blocks', () => {
    expect(countAnalysisReviewBlocks([message('a'), message('b')])).toBe(0)
  })

  it('counts the analysis-result block that renders the decision-review card', () => {
    expect(countAnalysisReviewBlocks([message('a', [analysisBlock])])).toBe(1)
  })

  it('POSITIVE CONTROL for the type filter: the OTHER phase-3 block kinds do not count', () => {
    // The same turn lands 8-14 phase-3 cards in the Olumi tab (measured in
    // probe-premortem-live.md §4 Q2). If the count were "any block", every
    // coaching card would read as a fresh analysis and the return would fire
    // on conversational turns that ran no analysis at all.
    const noise = [message('a', [coachingBlock, reviewCardBlock, coachingBlock])]
    expect(countAnalysisReviewBlocks(noise)).toBe(0)
    // …and it still finds the real one when it is buried among them.
    const mixed = [message('a', [coachingBlock, analysisBlock, reviewCardBlock])]
    expect(countAnalysisReviewBlocks(mixed)).toBe(1)
  })

  it('RERUN: a second analysis raises the count, so 1 → 2 is as detectable as 0 → 1', () => {
    const first = [message('a', [analysisBlock])]
    const second = [...first, message('b', [coachingBlock]), message('c', [analysisBlock])]
    expect(countAnalysisReviewBlocks(first)).toBe(1)
    expect(countAnalysisReviewBlocks(second)).toBe(2)
    expect(countAnalysisReviewBlocks(second)).toBeGreaterThan(countAnalysisReviewBlocks(first))
  })

  it('RELOAD: an unchanged transcript yields an unchanged count (no phantom arrival)', () => {
    const hydrated = [message('a', [analysisBlock])]
    expect(countAnalysisReviewBlocks(hydrated)).toBe(countAnalysisReviewBlocks(hydrated))
  })
})

/** The exact state of the tester the probes measured: they were reading the
 *  conversation, Run moved them to Analysis, they waited, the analysis landed. */
const RETURNS: RunReturnSignalInput = {
  aiPanelV2On: true,
  runAutoSwitchedToAnalysis: true,
  dockTab: 'results',
  dockEffectiveOpen: true,
  userInteractedSinceRun: false,
  reviewContentArrived: true,
}

describe('shouldReturnToOlumiAfterRun', () => {
  it('returns the passive tester the probes measured', () => {
    expect(shouldReturnToOlumiAfterRun(RETURNS)).toBe(true)
  })

  it('MUTANT — drop the flag gate: stands down with aiPanelV2 OFF (there is no Olumi tab)', () => {
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, aiPanelV2On: false })).toBe(false)
  })

  it('MUTANT — drop the we-moved-them gate: stands down when the run did not switch the tab', () => {
    // A user already on Analysis when they pressed Run chose that tab.
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, runAutoSwitchedToAnalysis: false })).toBe(false)
  })

  it('MUTANT — drop the tab gate: stands down when the user is no longer on Analysis', () => {
    // They navigated to Model/Compare mid-run; returning them to Olumi would
    // be a second unwanted move, not a correction of the first.
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, dockTab: 'diagnostics' })).toBe(false)
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, dockTab: 'compare' })).toBe(false)
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, dockTab: 'olumi' })).toBe(false)
  })

  it('MUTANT — drop the dock-open gate: stands down while the dock is the collapsed rail', () => {
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, dockEffectiveOpen: false })).toBe(false)
  })

  it('MUTANT — drop the interaction gate: stands down for a user who is doing something', () => {
    // THE ruling's load-bearing clause: never yank a user who navigated or
    // engaged themselves.
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, userInteractedSinceRun: true })).toBe(false)
  })

  it('MUTANT — drop the content gate: stands down when nothing arrived to return TO', () => {
    // The non-conversational run path completes the results store while putting
    // nothing in the Olumi tab; returning a user to an empty surface is worse
    // than leaving them on the numbers.
    expect(shouldReturnToOlumiAfterRun({ ...RETURNS, reviewContentArrived: false })).toBe(false)
  })
})
