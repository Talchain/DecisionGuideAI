/**
 * ROADMAP 2.225, side-effect trap — THE RAW ENUM TOKEN MUST NEVER BECOME A TURN.
 *
 * THE DEFECT THIS PINS. Every Phase 3 block also becomes a guidance item, and
 * `deriveGuidance` set that item's `primary_action.prompt` to
 * `action_intent ?? suggested_prompt ?? title`. `action_intent` is a raw ENUM
 * TOKEN (`gather_evidence`, `confirm_factor`, `open_inspector`). GuidanceStrip's
 * `case 'discuss'` submits `action.prompt` as the user's turn text:
 *
 *     visibleTextSubmitted: action.prompt,
 *     submittedText: action.prompt,
 *     onSendMessage(action.prompt, { hidden: true, ... })
 *
 * So clicking the guidance strip's action sent the literal string
 * "gather_evidence" to CEE as if the user had typed it. Machine tokens are
 * data-* only in this codebase — they are never user copy, and they are
 * certainly never user SPEECH.
 *
 * THE FIX. `action_intent` is dropped from the prompt chain entirely and the
 * producer-authored `action_prompt` (schemas 0.31.0) leads it:
 *     action_prompt ?? suggested_prompt ?? title
 * Every member of that chain is producer-authored prose. `title` is required,
 * so `primary_action` stays REQUIRED and no consumer needs an optional guard.
 */
import { describe, it, expect } from 'vitest'

import type { OlumiResponse } from '@talchain/schemas/boundary'

import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../responseParser'
import { extractPhase3FromV5Response } from '../extractPhase3FromV5Response'

/** Every ActionIntent member the contract declares, as raw enum tokens. */
const ENUM_TOKENS = [
  'gather_evidence',
  'confirm_factor',
  'open_inspector',
  'run_analysis',
  'what_would_flip',
  'add_option',
] as const

function responseWithBlocks(blocks: unknown[]): OlumiResponseWithExtensions {
  const base = {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse
  const target = base as OlumiResponseWithExtensions
  Object.defineProperty(target, ADDITIVE_EXTENSIONS_KEY, {
    value: Object.freeze({ phase3_blocks: blocks }),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return target
}

function coachingBlock(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'coaching',
    id: 'c-1',
    title: 'Your revenue estimate may be anchored',
    detail: 'The first number you gave has stayed put through three revisions.',
    ...extra,
  }
}

describe('deriveGuidance — primary_action.prompt is producer-authored prose, never an enum token', () => {
  it.each(ENUM_TOKENS)('never submits the raw action_intent token %s as turn text', (token) => {
    const { guidanceItems } = extractPhase3FromV5Response(
      responseWithBlocks([coachingBlock({ action_intent: token })]),
    )
    expect(guidanceItems).toHaveLength(1)
    const prompt = guidanceItems[0]!.primary_action.prompt
    expect(prompt).not.toBe(token)
    // Not merely "not equal" — the token must not appear at all, so a
    // composed "Let's gather_evidence" cannot sneak through either.
    expect(prompt).not.toContain(token)
    // It falls back to the producer's own headline, which IS prose.
    expect(prompt).toBe('Your revenue estimate may be anchored')
  })

  it('uses the producer action_prompt VERBATIM when supplied (schemas 0.31.0)', () => {
    const authored =
      'You said the first revenue figure was a placeholder. What range would you defend now?'
    const { guidanceItems } = extractPhase3FromV5Response(
      responseWithBlocks([
        coachingBlock({ action_intent: 'gather_evidence', action_prompt: authored }),
      ]),
    )
    expect(guidanceItems[0]!.primary_action.prompt).toBe(authored)
  })

  it('action_prompt outranks suggested_prompt, which outranks title', () => {
    const both = extractPhase3FromV5Response(
      responseWithBlocks([
        coachingBlock({ action_prompt: 'AUTHORED', suggested_prompt: 'SUGGESTED' }),
      ]),
    )
    expect(both.guidanceItems[0]!.primary_action.prompt).toBe('AUTHORED')

    const suggested = extractPhase3FromV5Response(
      responseWithBlocks([coachingBlock({ suggested_prompt: 'SUGGESTED' })]),
    )
    expect(suggested.guidanceItems[0]!.primary_action.prompt).toBe('SUGGESTED')

    const bare = extractPhase3FromV5Response(responseWithBlocks([coachingBlock({})]))
    expect(bare.guidanceItems[0]!.primary_action.prompt).toBe(
      'Your revenue estimate may be anchored',
    )
  })

  it('keeps action_intent available as data — it is dropped from the PROMPT, not from the item', () => {
    // The token is still legitimate machine metadata on the raw block; this
    // row narrows where it may travel, it does not delete it.
    const { rawBlocks } = extractPhase3FromV5Response(
      responseWithBlocks([coachingBlock({ action_intent: 'gather_evidence' })]),
    )
    expect(rawBlocks[0]!.raw).toMatchObject({ action_intent: 'gather_evidence' })
  })
})
