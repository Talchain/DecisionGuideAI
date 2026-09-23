/**
 * ⭐ ONE ANSWER TO "IS THE RESULT ON THIS CARD ABOUT THE MODEL ON SCREEN?"
 * for every node-card caption that shows a run-derived finding.
 *
 * Read from the estate's single freshness authority (`useAnalysisTrust`), and
 * mapped to the three things a card may truthfully say:
 *   · `current`     — the run is about this model.
 *   · `changed`     — the model is KNOWN to have changed since the run. The one
 *                     state that licenses `Last run ·` (ED 02:31Z, Q2).
 *   · `unconfirmed` — the currency cannot be confirmed. Must NOT manufacture a
 *                     "last run" claim (ED 02:31Z), and must not claim current.
 *   · `none`        — no run to speak of.
 *
 * ⚠ DRIVER AND TURNING-POINT CUES DO NOT USE THIS: spec §8 hides them unless the
 * run is current (`useAnalysisResultsAreCurrent`). This is for the findings the
 * spec KEEPS after the model changes — an option's result, the goal's chance —
 * which carry `Last run ·` rather than vanish (ED 11:52Z point 8).
 */
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import type { FreshnessDisplaySemantic } from '../../store/analysisFreshness'
import { OPTION_RESULT_COPY } from './metricVocabulary'

export type RunCurrency = 'current' | 'changed' | 'unconfirmed' | 'none'

export function runCurrencyOf(semantic: FreshnessDisplaySemantic | undefined): RunCurrency {
  switch (semantic) {
    case 'current':
      return 'current'
    case 'changed':
      return 'changed'
    case 'cannot_confirm':
      return 'unconfirmed'
    default:
      return 'none'
  }
}

export function useRunCurrency(): RunCurrency {
  return runCurrencyOf(useAnalysisTrust().semantic)
}

/** The option result's caption for a currency, or `null` to withhold it. */
export function optionResultCaption(currency: RunCurrency): string | null {
  switch (currency) {
    case 'current':
      return OPTION_RESULT_COPY.current
    case 'changed':
      return OPTION_RESULT_COPY.lastRun
    case 'unconfirmed':
      return OPTION_RESULT_COPY.unconfirmed
    default:
      return null
  }
}
