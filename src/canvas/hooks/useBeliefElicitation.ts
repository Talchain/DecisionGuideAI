/**
 * useBeliefElicitation — "say it in words, get a number" (ROADMAP 2.364).
 *
 * ONE elicitation client for every surface that offers the affordance, so the
 * debounce, the stale-response rule and the error copy cannot drift between
 * them. Today: `BeliefInput` (the standalone dual-mode control) and the
 * pre-analysis `CalibrateDrillIn` row.
 *
 * WHAT IT TALKS TO. `CEEClient.elicitBelief` → `/bff/cee/elicit-belief` →
 * (Netlify edge fn) → CEE `/assist/v1/elicit-belief`. The engine behind it is
 * DETERMINISTIC — a lexicon + regex parser, no LLM call and no network fan-out
 * (`olumi-assistants-service/src/cee/belief-elicitation/index.ts`) — which is
 * why a 500 ms debounce is the right shape: the answer arrives in milliseconds
 * and re-typing is cheap, so the only thing worth protecting is CEE's per-key
 * rate limit (60/min).
 *
 * THE STALE-RESPONSE RULE, and why a bare `await` is not enough. Every request
 * carries a sequence number and only the LATEST one may write state. Without
 * it, typing "pretty likely" then correcting to "unlikely" can render 0.70
 * against the word "unlikely" if the first response lands second — a suggestion
 * attributed to text the user has already replaced. That is a fabrication the
 * user cannot see is one, so it is guarded here rather than left to timing.
 *
 * ⚠ THE GUARANTEE ABOVE WAS ONCE ONLY HALF TRUE, AND THIS PARAGRAPH IS THE
 * CORRECTION (#572 review). The sequence was bumped when the debounce FIRED,
 * not when the text CHANGED — so between a keystroke and the next debounce
 * fire there was no new sequence to invalidate the old one, and the previous
 * phrase's answer could still land, render, and be ACCEPTED against text the
 * user had already replaced (a whole debounce + round-trip wide). And the
 * ALREADY-RENDERED suggestion was never cleared on retype, so even with no
 * response in flight the stale card stayed clickable.
 * Both halves are fixed at the same place, and for the same reason: the moment
 * the text changes, every answer about the OLD text is dead. `request()`
 * therefore invalidates and clears FIRST, before it decides whether to
 * schedule anything at all.
 *
 * NOTHING IS COMMITTED HERE. This hook produces a SUGGESTION. Applying it is
 * the calling surface's job, through that surface's existing commit path — the
 * hook deliberately owns no mutation, no wire event and no store write.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CEEClient } from '../../adapters/cee/client'
import type { BeliefElicitSuggestion } from '../../adapters/cee/types'

/** Matches the debounce the original BeliefInput shipped with. */
export const BELIEF_ELICITATION_DEBOUNCE_MS = 500

/**
 * Below this, a phrase is not yet an expression — "a", "ab" would send a
 * request per keystroke and get a clarifying question every time.
 */
const MIN_EXPRESSION_LENGTH = 3

/**
 * User-facing failure copy. Plain language, states what did NOT happen (the
 * house rule for every refusal on this surface), and never surfaces a status
 * code or an endpoint name.
 */
export const BELIEF_ELICITATION_ERROR_COPY =
  "I couldn't read that as a number. Nothing has changed — try a different wording, or type the number itself."

export interface BeliefElicitationTarget {
  /** The factor's id — CEE requires it and refuses an empty string. */
  nodeId: string
  /** The factor's label, quoted back in the engine's clarifying question. */
  nodeLabel: string
}

export interface BeliefElicitationApi {
  suggestion: BeliefElicitSuggestion | null
  loading: boolean
  error: string | null
  /** Debounced. Text shorter than a phrase clears the suggestion instead. */
  request: (text: string) => void
  /** Drop any pending request and clear suggestion/error. */
  reset: () => void
}

export function useBeliefElicitation(target: BeliefElicitationTarget): BeliefElicitationApi {
  const [suggestion, setSuggestion] = useState<BeliefElicitSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = useMemo(() => new CEEClient(), [])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequenceRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const { nodeId, nodeLabel } = target

  const reset = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Bump the sequence so an ALREADY-IN-FLIGHT response cannot repaint a
    // suggestion after the surface has been reset (the accept/close race).
    sequenceRef.current += 1
    setSuggestion(null)
    setError(null)
    setLoading(false)
  }, [])

  const request = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setError(null)

      // FIRST, unconditionally, before any length test or scheduling: the text
      // has changed, so every in-flight answer about the previous text is now
      // stale, and the rendered card describes a phrase that no longer exists.
      // Invalidate and clear together — a bump without a clear leaves a stale
      // card on screen with a live Accept button, which is the half of this
      // defect a sequence number alone never covered.
      sequenceRef.current += 1
      setSuggestion(null)

      const trimmed = text.trim()
      if (trimmed.length < MIN_EXPRESSION_LENGTH) {
        setLoading(false)
        return
      }

      debounceRef.current = setTimeout(() => {
        const seq = ++sequenceRef.current
        setLoading(true)
        client
          .elicitBelief({
            node_id: nodeId,
            node_label: nodeLabel,
            user_expression: trimmed,
            target_type: 'prior',
          })
          .then(result => {
            if (!mountedRef.current || seq !== sequenceRef.current) return
            setSuggestion(result)
            setLoading(false)
          })
          .catch(() => {
            if (!mountedRef.current || seq !== sequenceRef.current) return
            // The client already refuses an out-of-range value by throwing, so
            // this branch covers BOTH transport failure and a nonsense number.
            // Either way the honest report is the same: nothing changed.
            setSuggestion(null)
            setError(BELIEF_ELICITATION_ERROR_COPY)
            setLoading(false)
          })
      }, BELIEF_ELICITATION_DEBOUNCE_MS)
    },
    [client, nodeId, nodeLabel],
  )

  return { suggestion, loading, error, request, reset }
}

/**
 * The elicited probability as a plain-language chance ("about 70%").
 *
 * DISPLAY ONLY — this is the one place the ×100 appears, and it never feeds a
 * commit. The number that is committed is the probability itself; see
 * `factorValueEdit.ts`'s `'model_scale'` basis for why.
 */
export function formatElicitedChance(suggestedValue: number): string {
  return `about ${Math.round(suggestedValue * 100)}%`
}
