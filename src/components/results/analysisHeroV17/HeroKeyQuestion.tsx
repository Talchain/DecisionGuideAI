/**
 * HeroKeyQuestion — key question card with chips + +3 disclosure.
 *
 * The question text is glossary-scanned upstream in
 * `buildAnalysisHeroViewModel.selectKeyQuestion`. If no safe grounded
 * question is available, the orchestrator passes `null` and the caller
 * hides the card entirely.
 *
 * Render rule (2026-05-21): the card shows only when a real DQP is
 * available AND chat is open (chatPrefillAvailable === true). When chat
 * is closed, the chips can't meaningfully complete their action, so the
 * whole card hides — not just the chip strip. This removes the
 * "advertised but unclickable" failure mode the dangling question text
 * previously created.
 */

import { useState } from 'react'
import { typography } from '@/styles/typography'
import type { KeyQuestion } from './analysisHeroVM.types'

interface Props {
  keyQuestion: KeyQuestion
  onPrefillChat: (text: string) => void
  /** When false, the entire card is hidden. */
  chatPrefillAvailable: boolean
}

export function HeroKeyQuestion({ keyQuestion, onPrefillChat, chatPrefillAvailable }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (!chatPrefillAvailable) return null
  return (
    <section
      className="rounded-md border border-panel-border p-2.5 flex flex-col gap-1.5"
      aria-label="Key question"
      data-testid="hero-v17-key-question"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`${typography.panelMeta} text-text-light`}>
          <strong className={`${typography.panelHeader} text-text-header`}>Key question</strong>
        </p>
        {keyQuestion.extras.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            className={`${typography.panelMeta} text-text-light hover:text-info cursor-pointer`}
            data-testid="hero-v17-key-question-toggle"
          >
            {expanded ? 'Hide ▴' : `+${keyQuestion.extras.length} ▾`}
          </button>
        )}
      </div>
      <p
        className={`${typography.panelHeader} text-text-header line-clamp-2 break-words`}
        data-testid="hero-v17-key-question-text"
      >
        {keyQuestion.text}
      </p>
      {/* Lane 1 (P1): DSK science-provenance grounding line. Rendered ONLY
          when the prompt behind the question attested a dsk_claim_id upstream
          (see selectKeyQuestion) — no grounding object, no badge, no default.
          Plain DOM text (screen-reader readable, not colour-only); the claim
          and protocol ids ride as data-* attributes, never as user copy. */}
      {keyQuestion.grounding && (
        <p
          className={`${typography.panelMeta} text-text-light break-words`}
          data-testid="dsk-grounding"
          data-dsk-claim-id={keyQuestion.grounding.claimId}
          data-dsk-protocol-id={keyQuestion.grounding.protocolId}
        >
          Grounded in: {keyQuestion.grounding.principle}
          {keyQuestion.grounding.strength ? ` · ${keyQuestion.grounding.strength} evidence` : ''}
        </p>
      )}
      {/* Chips are prefill-only. The whole card is hidden upstream when
          chat is unavailable (see the early return above), so chips are
          always meaningfully clickable when this block renders. */}
      {keyQuestion.chips.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap" data-testid="hero-v17-key-question-chips">
          {keyQuestion.chips.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => onPrefillChat(`${keyQuestion.text} My answer: ${chip}`)}
              className={`px-2 py-0.5 rounded-full border border-panel-border bg-transparent ${typography.panelMeta} text-text-body hover:border-info hover:text-info focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info break-words`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
      {expanded && keyQuestion.extras.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-panel-border" data-testid="hero-v17-extra-questions">
          {keyQuestion.extras.map((q, i) => (
            <p key={i} className={`${typography.panelBody} text-text-body break-words`}>{q}</p>
          ))}
        </div>
      )}
    </section>
  )
}
