/**
 * WHAT_CHANGED_CHIP_MESSAGE — the message the "What changed?" pill (F2 CHANGE B)
 * sends to CEE.
 *
 * Deliberately a ZERO-import leaf module: the wire-contract spec
 * (src/v5/__tests__/whatChangedSend.spec.ts) is inside the narrow CI typecheck
 * gate's `src/v5/**` include, so it must be able to assert this constant
 * verbatim WITHOUT importing WhatChangedChip.tsx — that component transitively
 * pulls in the useConversation hook graph, which drags the whole
 * adapters/store/conversation surface (and its ~pre-existing type debt) into the
 * narrow gate. Keeping the constant here lets both the component and the pure
 * wire test share one source of truth cheaply.
 *
 * British English, sentence case, no internal vocabulary. CEE routes on the
 * typed chip.action_type, not on this text.
 */
export const WHAT_CHANGED_CHIP_MESSAGE = 'What changed since the last run?'
