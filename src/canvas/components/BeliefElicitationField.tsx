/**
 * "Say it in words" — the elicitation FIELD, one implementation, every surface.
 *
 * ROADMAP 2.364 shipped this block inside `CalibrateDrillIn`. ROADMAP 2.391
 * mounts the same affordance on `FactorControllablePanel`, which is where a
 * user actually is when they want to revise a belief: the pre-analysis
 * drill-in UNMOUNTS the moment "Analyse first pass" is clicked (measured on
 * deployed build `1730c6c5`, L55 §10.7 — `[data-testid="pre-analysis-v3"]` is
 * null post-run and no "… in words" affordance survives anywhere in the
 * document), so before this file the elicitation loop and a completed analysis
 * were mutually exclusive in a single session.
 *
 * WHY IT IS A COMPONENT AND NOT A SECOND COPY. Two surfaces rendering the same
 * user-facing sentences and the same three-way branch (loading / ambiguous /
 * offer) is the hand-maintained mirror CLAUDE.md trap 12 is about: the copy
 * would drift, and the `needs_clarification`-alone suppression rule — which an
 * adversarial review had to put in ONCE already (#572, minor 7) — would have to
 * be remembered twice. The branch logic and every string live here; each
 * surface supplies only its own chrome and its own commit.
 *
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT OWN:
 *   - the HOOK. `useBeliefElicitation` (debounce, sequence/stale-response
 *     discipline, error copy) is passed IN. A second instance per surface would
 *     be a second race to reason about.
 *   - the GATE. Whether the affordance may be offered at all is
 *     `acceptsElicitedBelief(nodeData)`, read REACTIVELY by the surface from
 *     the store — see its docstring for why capless-and-unitless is the
 *     boundary and why widening it is a real feature.
 *   - the COMMIT. `onAccept` receives the probability and nothing else; the
 *     surface routes it through its own existing `factor_value_edit` path, and
 *     `buildFactorValueEditEvent` carries the structural refusals for every
 *     caller.
 */

import { useEffect, useRef, useState } from 'react'
import Tooltip from '../../components/Tooltip'
import { typography, typo } from '../../styles/typography'
import { formatElicitedChance, type BeliefElicitationApi } from '../hooks/useBeliefElicitation'

/**
 * The toggle's accessible name, and the field's.
 *
 * Exported rather than spelled at each call site for the same reason the JSX
 * below is shared: two surfaces, one sentence. The toggle BUTTON stays with
 * each surface (they use different icon chrome), so its label is the one thing
 * that could still drift — deriving it removes that.
 */
export const describeInWordsToggleLabel = (label: string): string =>
  `Describe your estimate for ${label} in words`

export const describeInWordsFieldLabel = (label: string): string =>
  `Describe ${label} in words`

/**
 * Shown when the engine flagged itself unsure and offered NO options to choose
 * between. Before #572's review this shape fell through to "That reads as about
 * X%" + Use this, offering a number the engine had just said it was unsure
 * about, without its question.
 */
export const BELIEF_ELICITATION_UNSURE_COPY =
  "I couldn't pin that down. Try another wording, or type the number."

export interface BeliefElicitationFieldProps {
  /** The factor's label — quoted in every accessible name on this field. */
  label: string
  /** The phrase currently in the field (the surface owns the state). */
  phrase: string
  /**
   * Called on every keystroke. The surface is expected to set its own phrase
   * state AND call `elicitation.request(next)` — the hook's `request` is what
   * invalidates any in-flight answer about the previous text.
   */
  onPhraseChange: (next: string) => void
  /** Escape in the field. Optional: not every surface has something to close. */
  onEscape?: () => void
  elicitation: BeliefElicitationApi
  /** Accept a probability in [0,1]. The surface owns the commit. */
  onAccept: (value: number) => void
  /** Surface-specific test id on the wrapper. */
  testId: string
}

export function BeliefElicitationField({
  label,
  phrase,
  onPhraseChange,
  onEscape,
  elicitation,
  onAccept,
  testId,
}: BeliefElicitationFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [announcement, setAnnouncement] = useState('')

  /**
   * ⚠ THE DEAD END THIS EXISTS TO CLOSE (found live by Codex; confirmed at the
   * bytes at `122b847a` AND at this lane's tip, on BOTH hosts).
   *
   * Revealing the field only flipped `inWords`. The new input had no ref, no
   * `focus()` and no `scrollIntoView()`, so on a row near the panel's lower
   * edge **the UI appeared not to change at all**: focus stayed on the icon,
   * the field was off-screen, and the user typed their phrase INTO THE CHAT —
   * where it does nothing. The headline feature was a practical dead end for
   * exactly the users who did what the affordance invited.
   *
   * FOCUS ON MOUNT, NOT IN THE CLICK HANDLER, and that is the whole point:
   * this component only mounts when the field is revealed, so the behaviour is
   * identical however the reveal happened — pointer, Enter, Space, or a future
   * caller that reveals it some other way. A handler on the toggle would have
   * to be duplicated per host and per input modality, which is how the two
   * hosts drifted in the first place.
   */
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    // The repo's own guard (InspectorGuidanceSection.tsx:79): jsdom does not
    // implement scrollIntoView, and an unguarded call turns every test that
    // renders this field into a TypeError.
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  /**
   * Announced SEPARATELY from the focus effect, so a label change re-announces
   * without yanking focus out of a field the user is mid-way through typing
   * into. That part IS pinned.
   *
   * ⚠ THE SET-AFTER-MOUNT PART IS A CONVENTION, NOT A GUARANTEE, AND SAYING SO
   * IS THE POINT. The reason for an effect rather than an initial `useState`
   * value is that a live region which ALREADY contains its text when it enters
   * the DOM often is not announced at all — the AT has no CHANGE to report.
   * But **jsdom cannot see the difference**: mutant M16 (move the text into the
   * initial state) left all 55 tests GREEN. This comment used to assert the
   * behaviour as though the suite protected it; it does not, and an unpinned
   * claim dressed as a guarantee is the defect class this estate hunts. It is
   * verifiable only against a real screen reader — same standing as the
   * off-screen half of the scroll fix.
   */
  useEffect(() => {
    setAnnouncement(`Describe ${label} in words — for example, "pretty likely".`)
  }, [label])

  return (
    <div className="space-y-1" data-testid={testId}>
      {/*
        `aria-live` WITHOUT `role="status"`, deliberately. `role="status"` is
        just sugar for an implicit polite live region, and adding a THIRD one to
        a component that already has two conditional `role="status"` paragraphs
        ("Reading that…" and the error line) made `getByRole('status')`
        ambiguous — it broke two existing CalibrateDrillIn tests the moment this
        landed. Competing status regions are worse for a screen reader too: the
        announcement, the loading line and the error line would all claim the
        same role while describing different things.
      */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <input
        ref={inputRef}
        aria-label={describeInWordsFieldLabel(label)}
        className={`${typography.panelBody} h-7 w-56 rounded-lg border border-panel-border bg-panel px-2 text-text-header outline-none placeholder:text-text-light focus:border-info focus:ring-2 focus:ring-info/20`}
        placeholder="e.g. pretty likely"
        value={phrase}
        onChange={e => onPhraseChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') onEscape?.()
        }}
      />

      {elicitation.loading && (
        <p className={`${typography.panelMeta} text-text-light`} role="status">
          Reading that…
        </p>
      )}

      {elicitation.error && (
        <p className={`${typography.panelMeta} text-warning`} role="status">
          {elicitation.error}
        </p>
      )}

      {/*
        AMBIGUOUS PHRASE — the engine's own question, verbatim, and its own
        option labels. Not paraphrased: it names the factor and the reading it
        is unsure about, and rewriting it here would put words in the engine's
        mouth that the engine cannot stand behind.
      */}
      {elicitation.suggestion?.needs_clarification ? (
        <div className="space-y-1">
          <p className={`${typography.panelMeta} text-text-body`}>
            {/*
              A response can flag itself unsure and carry NO options.
              `needs_clarification` ALONE suppresses the offer; the fallback
              line says what happened.
            */}
            {elicitation.suggestion.clarifying_question ?? BELIEF_ELICITATION_UNSURE_COPY}
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Readings for ${label}`}>
            {(elicitation.suggestion.options ?? []).map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onAccept(opt.value)}
                className={typo(
                  'panelMeta',
                  'rounded-full border border-panel-border bg-transparent px-2.5 py-1 text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : elicitation.suggestion ? (
        <div className="flex items-center gap-2">
          {/*
            The number, as a chance, in plain words. The engine's REASONING and
            CONFIDENCE are expert detail and stay behind the tooltip — inline
            they read as hedging.
          */}
          <Tooltip
            content={`${elicitation.suggestion.reasoning} (${elicitation.suggestion.confidence} confidence)`}
            delay={300}
          >
            <span className={`${typography.panelMeta} text-text-body`}>
              That reads as {formatElicitedChance(elicitation.suggestion.suggested_value)}
            </span>
          </Tooltip>
          <button
            type="button"
            onClick={() => onAccept(elicitation.suggestion!.suggested_value)}
            aria-label={`Use ${formatElicitedChance(elicitation.suggestion.suggested_value)} for ${label}`}
            className={typo(
              'panelMeta',
              'rounded-full border border-panel-border bg-transparent px-2.5 py-1 text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40',
            )}
          >
            Use this
          </button>
        </div>
      ) : null}
    </div>
  )
}
