/**
 * AnalysisStateCue — one canvas-level sentence that explains the cards'
 * `Last run ·` labels.
 *
 * ⭐ WHY IT EXISTS — Paul 23 Sep contract feedback point 14 (ACCEPT): "Add a
 * small overall analysis-state cue … `Model changed · previous findings shown
 * as Last run`. This makes individual `Last run ·` labels understandable."
 * Without it a user sees `Last run ·` on some cards and not on others and has
 * to work out for themselves why.
 *
 * ⭐ ONE AUTHORITY, THE CARDS' OWN. It shows on exactly one predicate:
 * `useModelChangedSinceRun()` — the same hook the factor cards, the `Key
 * driver N` badge and the inspector's `ImportanceBar` ask before prefixing
 * `LAST_RUN_PREFIX`, and the same composed verdict (`useAnalysisTrust()
 * .semantic === 'changed'`) behind the `'changed'` arm of `runCurrency.ts` that
 * gives option cards their `Last run` caption. So the cue cannot say "shown as
 * Last run" while no card does, and it cannot stay silent while they do.
 *
 * ⛔ WHAT IT DELIBERATELY DOES NOT SAY
 *   · never run / no run → nothing. There is no previous finding to describe.
 *   · current → nothing. The findings ARE about this model; a cue would be noise.
 *   · cannot confirm → nothing. That state may assert neither currency nor
 *     change (ED 02:31Z), and no card says `Last run` in it
 *     (`optionResultCaption('unconfirmed')` is `Model result`), so there is no
 *     label for this sentence to explain. Silence is the one wording that
 *     asserts neither.
 *   · no count. "2 edits since" would need an authoritative edit count against
 *     the displayed run, and none is read here (Paul point 14: "avoid invented
 *     counts"). The sentence names the state, not its size.
 *   · no instruction. It does not tell the user to re-run; whether to is theirs.
 *
 * ⭐ PLACEMENT — the overlay band's bottom-right cell, never a hand-written
 * position (`CanvasOverlayBand.tsx`: one slot, one occupant, never over a node).
 * That cell had no claimant, so the cue takes nothing from the notices in
 * bottom-centre. While the cue holds the cell the band gives its column a floor
 * (`OVERLAY_BAND_RIGHT_CELL_MIN`), so a wide centre occupant — the saved-example
 * banner — can no longer squeeze it to nothing (served defect N3, 24 Sep). The
 * width guard in `AnalysisStateCue.module.css` now withdraws the cue only on a
 * canvas narrower than that floor, rather than letting it overflow across its
 * neighbour; the cards' own labels still carry the state.
 *
 * Styling is neutral (panel surface, body text, muted icon) — it is a
 * statement of state, not a warning and not an attention cue (Paul point 9:
 * info blue is the attention channel). Text is 12px `caption` in `text-body`
 * rather than the muted token, for contrast (Paul point 12). The clock icon is
 * decorative beside a sentence that names the state in words, so it is
 * `aria-hidden` and the sentence is the accessible content of the `status`.
 */
import { History } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useOverlayCell } from './CanvasOverlayBand'
import { useModelChangedSinceRun } from '../hooks/useModelChangedSinceRun'
import { LAST_RUN_PREFIX } from '../nodes/shared/metricVocabulary'
import { typography } from '../../styles/typography'
import styles from './AnalysisStateCue.module.css'

export const ANALYSIS_STATE_CUE_TESTID = 'analysis-state-cue'

/**
 * The label the cards render, BUILT from their own prefix (`'Last run · '` →
 * `'Last run'`) rather than re-typed, so the cue names the words on the cards.
 */
export const ANALYSIS_STATE_CUE_LABEL = LAST_RUN_PREFIX.replace(/\s*·\s*$/, '')

export const ANALYSIS_STATE_CUE_HEAD = 'Model changed'
export const ANALYSIS_STATE_CUE_DETAIL = `previous findings shown as ${ANALYSIS_STATE_CUE_LABEL}`
/** The whole sentence, as it reads on screen and to assistive technology. */
export const ANALYSIS_STATE_CUE_COPY = `${ANALYSIS_STATE_CUE_HEAD} · ${ANALYSIS_STATE_CUE_DETAIL}`

export function AnalysisStateCue() {
  const modelChangedSinceRun = useModelChangedSinceRun()
  // Hooks stay unconditional: the cue's own condition is passed as `wants`, so
  // a cue with nothing to say never holds the cell.
  const { granted, target } = useOverlayCell('bottom-right', 'analysis-state-cue', modelChangedSinceRun)

  if (!modelChangedSinceRun || !granted) return null

  const body = (
    <div className={styles.fit} data-testid={`${ANALYSIS_STATE_CUE_TESTID}-fit`}>
      <div
        data-testid={ANALYSIS_STATE_CUE_TESTID}
        role="status"
        aria-live="polite"
        className={`${styles.cue ?? ''} pointer-events-auto inline-flex max-w-full items-start gap-1.5 rounded-lg border border-panel-border bg-panel px-2.5 py-1 shadow-sm`}
      >
        <History className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" aria-hidden="true" />
        <p className={`${typography.caption} min-w-0 text-text-body`}>
          <span className="font-medium text-text-header">{ANALYSIS_STATE_CUE_HEAD}</span>
          {' · '}
          {ANALYSIS_STATE_CUE_DETAIL}
        </p>
      </div>
    </div>
  )

  // No band (a standalone render, as this component's own spec mounts it)
  // means no portal target — draw inline, exactly as the other occupants do.
  return target ? createPortal(body, target) : body
}
