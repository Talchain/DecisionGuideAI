/**
 * V5 eligibility predicate — unit tests.
 *
 * Tests the pure predicate so we don't need to drive the full useConversation
 * hook for edge-guard coverage. The predicate's job is to route turns V5 A1
 * can't handle (tools, chips, system events, post-analysis, prior-tool
 * conversations) silently to V4, with no user-visible V5 artefact.
 */

import { describe, it, expect } from 'vitest'
import { isV5Eligible } from '../eligibility'
import type { ConversationMessage } from '../../canvas/conversation/types'

const BASE = {
  flag: 'true' as string | undefined,
  chipMeta: undefined,
  turnType: undefined,
  source: undefined,
  mode: 'user' as const,
  messages: [] as ConversationMessage[],
  analysisStateReady: false,
  resultsStatus: undefined as string | undefined,
}

describe('isV5Eligible', () => {
  it('returns eligible=true when all conditions pass', () => {
    const result = isV5Eligible({ ...BASE })
    expect(result).toEqual({ eligible: true })
  })

  it('returns flag_off when flag !== "true"', () => {
    expect(isV5Eligible({ ...BASE, flag: 'false' })).toEqual({ eligible: false, reason: 'flag_off' })
    expect(isV5Eligible({ ...BASE, flag: undefined })).toEqual({ eligible: false, reason: 'flag_off' })
    expect(isV5Eligible({ ...BASE, flag: '' })).toEqual({ eligible: false, reason: 'flag_off' })
  })

  it('returns system_mode on system-event turns', () => {
    expect(isV5Eligible({ ...BASE, mode: 'system' })).toEqual({ eligible: false, reason: 'system_mode' })
  })

  it('returns chip_metadata when chipMeta is present (deterministic chip action)', () => {
    const chipMeta = { action_type: 'set_factor_value', parameters: { target_id: 'fac_x', value: 0.04 } }
    expect(isV5Eligible({ ...BASE, chipMeta })).toEqual({ eligible: false, reason: 'chip_metadata' })
  })

  it('returns turn_type_hint when turnType is set (tool routing hint)', () => {
    expect(isV5Eligible({ ...BASE, turnType: 'run_analysis' })).toEqual({
      eligible: false,
      reason: 'turn_type_hint',
    })
  })

  it('returns chip_source on chip-originated free-text turns', () => {
    expect(isV5Eligible({ ...BASE, source: 'chip' })).toEqual({ eligible: false, reason: 'chip_source' })
    expect(isV5Eligible({ ...BASE, source: 'chip_click' })).toEqual({ eligible: false, reason: 'chip_source' })
  })

  it('returns retry_source when source is retry (replay of failed turn)', () => {
    expect(isV5Eligible({ ...BASE, source: 'retry' })).toEqual({ eligible: false, reason: 'retry_source' })
  })

  it('returns analysis_ran when analysisStateReady is true', () => {
    expect(isV5Eligible({ ...BASE, analysisStateReady: true })).toEqual({
      eligible: false,
      reason: 'analysis_ran',
    })
  })

  it('returns analysis_ran when results.status === complete', () => {
    expect(isV5Eligible({ ...BASE, resultsStatus: 'complete' })).toEqual({
      eligible: false,
      reason: 'analysis_ran',
    })
  })

  it('stays eligible when analysis is mid-flight but not complete', () => {
    expect(isV5Eligible({ ...BASE, resultsStatus: 'running' })).toEqual({ eligible: true })
    expect(isV5Eligible({ ...BASE, resultsStatus: 'idle' })).toEqual({ eligible: true })
  })

  it('returns prior_tool_calls when a prior assistant message has blocks', () => {
    const messages: ConversationMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', timestamp: new Date() },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Patch ready',
        blocks: [
          {
            type: 'graph_patch',
            summary: 'Add a factor',
            operations: [],
          } as unknown as NonNullable<ConversationMessage['blocks']>[number],
        ],
        timestamp: new Date(),
      },
    ]
    expect(isV5Eligible({ ...BASE, messages })).toEqual({ eligible: false, reason: 'prior_tool_calls' })
  })

  it('stays eligible when prior assistant messages have no blocks (pure text history)', () => {
    const messages: ConversationMessage[] = [
      { id: 'u1', role: 'user', content: 'first turn', timestamp: new Date() },
      { id: 'a1', role: 'assistant', content: 'first reply', timestamp: new Date() },
      { id: 'u2', role: 'user', content: 'second turn', timestamp: new Date() },
    ]
    expect(isV5Eligible({ ...BASE, messages })).toEqual({ eligible: true })
  })

  it('stays eligible when assistant blocks array is present but empty', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'no tool ran',
        blocks: [],
        timestamp: new Date(),
      },
    ]
    expect(isV5Eligible({ ...BASE, messages })).toEqual({ eligible: true })
  })

  it('evaluates conditions in declared order (flag before mode before chipMeta)', () => {
    // flag_off short-circuits before any other check fires
    expect(
      isV5Eligible({ ...BASE, flag: 'false', mode: 'system', chipMeta: { action_type: 'x' } }),
    ).toEqual({ eligible: false, reason: 'flag_off' })
    // mode short-circuits before chipMeta check fires
    expect(isV5Eligible({ ...BASE, mode: 'system', chipMeta: { action_type: 'x' } })).toEqual({
      eligible: false,
      reason: 'system_mode',
    })
  })
})
