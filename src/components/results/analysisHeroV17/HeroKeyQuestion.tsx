/**
 * HeroKeyQuestion — key question card with chips + +3 disclosure.
 *
 * The question text is glossary-scanned upstream in
 * `buildAnalysisHeroViewModel.selectKeyQuestion`. If no safe grounded
 * question is available, this component does not render — the orchestrator
 * passes `null` and the caller hides the card entirely.
 */

import { useState } from 'react'
import { typography } from '@/styles/typography'
import type { KeyQuestion } from './analysisHeroVM.types'

interface Props {
  keyQuestion: KeyQuestion
  onPrefillChat: (text: string) => void
  /** When false, the answer chips render as disabled. */
  chatPrefillAvailable: boolean
}

export function HeroKeyQuestion({ keyQuestion, onPrefillChat, chatPrefillAvailable }: Props) {
  const [expanded, setExpanded] = useState(false)
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
        className={`${typography.panelHeader} text-text-header`}
        data-testid="hero-v17-key-question-text"
      >
        {keyQuestion.text}
      </p>
      {keyQuestion.chips.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {keyQuestion.chips.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => onPrefillChat(`${keyQuestion.text} My answer: ${chip}`)}
              disabled={!chatPrefillAvailable}
              title={chatPrefillAvailable ? undefined : 'Open the chat panel to answer'}
              className={`px-2 py-0.5 rounded-full border border-panel-border bg-transparent ${typography.panelMeta} text-text-body hover:border-info hover:text-info focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-panel-border disabled:hover:text-text-body`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
      {expanded && keyQuestion.extras.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-panel-border" data-testid="hero-v17-extra-questions">
          {keyQuestion.extras.map((q, i) => (
            <p key={i} className={`${typography.panelBody} text-text-body`}>{q}</p>
          ))}
        </div>
      )}
    </section>
  )
}
