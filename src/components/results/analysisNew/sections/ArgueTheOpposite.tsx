/**
 * "Argue the opposite" — the consider-the-opposite ACT.
 *
 * ⭐⭐ WHAT THIS IS FOR. The standing objection to this tab is that it is a big
 * lump of text rather than a tool for enhancing critical and creative thinking.
 * A tool offers ACTS. This is one: a control, beside a finding, that runs the
 * best-evidenced debiasing move in the literature against the run's own
 * arithmetic, and brings back an answer the reader can act on.
 *
 * ⚠⚠ IT RENDERS TWO DIFFERENT CLAIMS AND NEVER BLENDS THEM. `buildArgueTheOppositeAsk`
 * owns the rule; this file renders whichever it returns and nothing else. The
 * form is stamped on the control as `data-argue-the-opposite-form` so the
 * distinction is observable from outside the copy — a test that could only
 * check the sentence would have to match prose, and would stop discriminating
 * the first time a word changed (trap 13b: a guard whose discrimination depends
 * on something nothing pins).
 *
 * ⚠ NOTHING RENDERS WHEN THERE IS NOTHING TO ASK ABOUT. `buildArgueTheOppositeAsk`
 * returns `null` for a run with no reversal finding, and `null` renders no
 * control at all — not a disabled one, not a tooltip explaining why it is
 * unavailable. That rule is enforced elsewhere in this codebase and the greyed,
 * permanently-dead Undo pair in the sidebar is the counter-example.
 *
 * ⛔ THE ACT DOES NOT MUTATE THE MODEL. It opens the existing ask drawer with a
 * PREFILLED, EDITABLE question; the user reads it and sends it. There is no
 * add, no value change, and this surface auto-sends nothing — the same rule
 * `StrengthenTheReasoning`'s other two routes already hold, and the same reason:
 * a second dispatch authority would let this tab diverge in what it DID as well
 * as in what it showed.
 */

import { Lightbulb } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { buildArgueTheOppositeAsk } from '../considerTheOppositeAsk'
import type { GlanceCondition } from '../analysisNewTypes'

export interface ArgueTheOppositeProps {
  /**
   * The run's calculated reversal condition, or `null` when it produced none.
   *
   * ⚠ THE VIEW MODEL'S OWN OBJECT, PASSED WHOLE. Handing this component the
   * three strings separately would make the caller decide which arm applies,
   * and the caller is exactly where that decision must not live — every new
   * mount would re-answer the honesty question in its own words.
   */
  condition: GlanceCondition | null
  testId?: string
}

export function ArgueTheOpposite({
  condition,
  testId = 'analysis-new-strengthen-argue-the-opposite',
}: ArgueTheOppositeProps) {
  const ask = buildArgueTheOppositeAsk(condition)
  if (!ask) return null

  return (
    <div className="mb-3 rounded-md border border-panel-border bg-panel-hover px-2 py-2">
      {/* The claim, and it is the honest one for this run either way. */}
      <p
        className={`${typography.panelBody} text-text-body m-0`}
        data-testid={`${testId}-lead`}
      >
        {ask.lead}
      </p>
      <button
        type="button"
        onClick={() =>
          openAskOlumi({
            context: ask.context,
            draft: ask.draft,
            label: ask.label,
            // `chip` — a conversation-typed turn, so `chip_metadata` survives
            // the wire and CEE learns which technique was invoked. Without the
            // parameters the drawer still opens with the right question and
            // nothing looks broken; CEE simply never learns what it was asked.
            source: 'chip',
            parameters: ask.parameters,
            // The catalogue entry's accepted intent, where one names the same
            // move. Absent stays absent: the wire gate fails closed, so a
            // narrowed accepted-set degrades this to prompt text rather than
            // asking CEE to run the wrong protocol under a science label.
            ...(ask.intent ? { intent: ask.intent } : {}),
            ...(ask.targetId ? { targetId: ask.targetId } : {}),
          })
        }
        className={`${typography.panelBody} mt-2 inline-flex items-center gap-1 rounded-md bg-info/10 px-2 py-1 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        data-testid={testId}
        /* ⚠ THE FORM IS ON THE CONTROL, NOT INFERRED FROM THE COPY. It is what
           lets the honesty rule be asserted by identity rather than by reading
           the sentence back. */
        data-argue-the-opposite-form={ask.form}
      >
        <Lightbulb className="w-3 h-3" aria-hidden={true} />
        {ask.label}
      </button>
    </div>
  )
}
