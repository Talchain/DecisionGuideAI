/**
 * THE MODEL TAB'S OPENING LINE — what question this model is about.
 *
 * Closes the 29 Jul design's sharpest criticism (§2): *"Nothing on the tab says
 * what this decision is."* One line, above the outline, stating the question the
 * model is built around.
 *
 * ⭐ A PROJECTION, NOT A SURFACE WITH ITS OWN FACTS. Every word below is either
 * a product noun from `domain/vocabulary` or a value from
 * `projectModelQuestion`, which is a pure function of the nodes. This component
 * holds no state, reads no store and calls no hook, so the boundary guard's
 * "nothing here can FIRE while unmounted" holds by construction.
 *
 * ⛔ IT STATES, IT DOES NOT INSTRUCT. `theTabDoesNotPromiseWhatItCannotDo`
 * governs this surface: three sentences on the live tab once told the reader to
 * do something the tab had no affordance for. Both absences here name a state
 * and stop. A gap is acceptable where a lie is not.
 *
 * ⛔ NO LEADER, NO RECOMMENDATION, NO RACE. The Model tab states composition.
 */
import type { Node } from '@xyflow/react'

import { projectModelQuestion } from './modelQuestion'
import { DECISION_NODE_LABEL } from '../domain/vocabulary'
import { typography } from '../../styles/typography'

export const MODEL_QUESTION_TESTID = 'model-tab-v2-question'

/**
 * ⚠ TWO ABSENCES, TWO SENTENCES, BECAUSE THEY ARE DIFFERENT FACTS. "Nobody has
 * written it" describes a node that exists on the canvas; "it is not in this
 * model" describes a model with no question node at all. One string for both
 * would be false in whichever case it was not written for.
 *
 * Neither carries an em dash, and neither tells the reader to go and do
 * something (Paul's standing rulings; pinned by the spec beside this file).
 */
const NOT_WRITTEN_YET = 'Not written yet'
const NOT_IN_THIS_MODEL_YET = 'Not in this model yet'

export interface ModelQuestionLineProps {
  /**
   * The same node array the outline projects its rows from. Passed rather than
   * read: no v2 file but the mount host may reach a store, and a line that
   * derived its nodes from anywhere else could name a different question from
   * the row directly below it.
   */
  nodes: readonly Node[]
}

export function ModelQuestionLine({ nodes }: ModelQuestionLineProps) {
  const question = projectModelQuestion(nodes)
  const stated = question.state === 'stated'
  const text = stated
    ? question.label
    : question.state === 'unwritten'
      ? NOT_WRITTEN_YET
      : NOT_IN_THIS_MODEL_YET

  return (
    <p
      data-testid={MODEL_QUESTION_TESTID}
      data-state={question.state}
      className={`${typography.panelBody} text-text-light`}
    >
      {/* The product's ONE spelling for this node, never a re-typed literal. */}
      <span className="font-medium">{DECISION_NODE_LABEL}:</span>{' '}
      <span
        className={
          stated ? `${typography.panelHeader} text-text-header` : 'italic text-text-light'
        }
      >
        {text}
      </span>
    </p>
  )
}
