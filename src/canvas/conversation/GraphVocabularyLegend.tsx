/**
 * GraphVocabularyLegend — F16: the small "What do these terms mean?"
 * affordance rendered near phase-3 coaching/review cards
 * (COACHING-REVIEW-UI-BRIEF names the legend affordance; the brief
 * specifies no legend copy, so this is the minimal legend of the node/edge
 * vocabulary the cards' target references use).
 *
 * Static UI-authored educational copy only — it defines the canvas
 * vocabulary, never interprets producer data (no values, no thresholds,
 * no science interpretation), so the UI-passthrough doctrine is not in
 * play. Collapsed by default; outlined text affordance per DS (no filled
 * pill, Lucide icon only).
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { typography } from '../../styles/typography'
import styles from './Conversation.module.css'

/** Minimal node/edge vocabulary used by phase-3 card target references. */
const LEGEND_TERMS: ReadonlyArray<{ term: string; definition: string }> = [
  { term: 'Decision', definition: 'The choice you are weighing up.' },
  { term: 'Option', definition: 'A course of action you could take.' },
  { term: 'Factor', definition: 'Something that influences how things turn out.' },
  // Outcome was the one canvas node kind this legend never named, while the
  // canvas's own "How to read this" key did — so a card referring to an
  // outcome node pointed at vocabulary the primer did not define.
  { term: 'Outcome', definition: 'A result the options lead to.' },
  { term: 'Risk', definition: 'An uncertain event that could work against you.' },
  { term: 'Goal', definition: 'The outcome you are trying to achieve.' },
  { term: 'Constraint', definition: 'A limit the decision must respect.' },
  { term: 'Link', definition: 'An arrow showing one element influencing another.' },
]

export function GraphVocabularyLegend() {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.vocabularyLegend}>
      <button
        type="button"
        className={styles.vocabularyLegendToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <HelpCircle size={12} aria-hidden="true" />
        What do these terms mean?
        {open
          ? <ChevronUp size={12} aria-hidden="true" />
          : <ChevronDown size={12} aria-hidden="true" />}
      </button>
      {open && (
        <dl className={styles.vocabularyLegendList} aria-label="Graph vocabulary">
          {LEGEND_TERMS.map(({ term, definition }) => (
            <div key={term} className={styles.vocabularyLegendRow}>
              <dt className={`${typography.panelHeader} ${styles.vocabularyLegendTerm}`}>{term}</dt>
              <dd className={`${typography.panelMeta} ${styles.vocabularyLegendDefinition}`}>
                {definition}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
