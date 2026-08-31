import { useId, useMemo, useState } from 'react'
import { BookOpenText, CircleDot, GitBranch, Layers3 } from 'lucide-react'
import { useCanvasStore } from '@/canvas/store'
import { typography } from '@/styles/typography'
import { readDecisionBriefViewModel, type DecisionBriefViewModel } from './decisionBriefViewModel'
import { selectEstimatedInterventions } from './estimatedInterventions'
import { ICON_STATUS } from '../../../canvas/conversation/panelIcons'

interface BriefGroupProps {
  title: string
  items: string[]
  icon: typeof CircleDot
  expanded: boolean
  testId: string
}

const PREVIEW_ITEMS = 1

function BriefGroup({ title, items, icon: Icon, expanded, testId }: BriefGroupProps) {
  if (items.length === 0) return null
  const visible = expanded ? items : items.slice(0, PREVIEW_ITEMS)
  const hiddenCount = items.length - PREVIEW_ITEMS

  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className={`${typography.panelMeta} flex items-center gap-1.5 text-text-light`}>
        <Icon size={ICON_STATUS} className="shrink-0 text-info" aria-hidden="true" />
        <span>{title}</span>
      </dt>
      <dd className="mt-1.5 min-w-0">
        <ul className="space-y-1" aria-label={title}>
          {visible.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className={`${typography.panelBody} flex min-w-0 items-start gap-1.5 text-text-body`}
            >
              <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-text-light/70" aria-hidden="true" />
              <span className="min-w-0 break-words whitespace-pre-wrap">{item}</span>
            </li>
          ))}
        </ul>
        {!expanded && hiddenCount > 0 && (
          <p className={`${typography.panelMeta} mt-1 text-text-light`} aria-hidden="true">
            +{hiddenCount} more
          </p>
        )}
      </dd>
    </div>
  )
}

export interface DecisionBriefSectionProps {
  brief: DecisionBriefViewModel
  /**
   * ⚠ THE PERMISSION, CONSUMED — NEVER DERIVED. This is `hasLeadingOption` from
   * `deriveDecisionVerdict`, "the single boolean every surface must gate on
   * before asserting OR denying a leading option", resolved once by the parent.
   *
   * It gates `robustnessCaveat`, which is a LEADER-RANKING member: CEE strips it
   * on a withheld turn and its absence IS the withheld signal. The caveat's own
   * presence must never be read as evidence that a ranking may be spoken about —
   * that is how Authority 3 came to reconstruct a withheld leader and print
   * "X is slightly ahead" beside CEE's "no option can be put forward yet".
   *
   * Required, not defaulted. A default of `true` would silently re-open the
   * claim for every future caller — the mirror-that-reads-green failure mode.
   */
  leaderClaimPermitted: boolean

  /**
   * The option→factor effect values THE MODEL CHOSE, already formatted by
   * `estimatedInterventions.ts`. Joined into "What Olumi assumed" because they
   * answer that heading's exact question from a second source — see the join
   * comment at `groups` below.
   *
   * ⭐ REQUIRED, NOT DEFAULTED, for the same reason as `leaderClaimPermitted`
   * one field up, though the harm runs the other way. A default of `[]` could
   * never state a falsehood, but it WOULD let a caller silently omit the
   * disclosure and still render a subtitle promising it — which is precisely
   * the defect being closed here, reappearing as a mirror that reads green.
   * Every caller states its answer.
   */
  estimatedInterventions: string[]
}

/** Store-free presentation, exported for focused and adversarial tests. */
export function DecisionBriefSection({
  brief,
  leaderClaimPermitted,
  estimatedInterventions,
}: DecisionBriefSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  /**
   * ⭐ "What this rests on" USED to render `key_assumptions`, and that was the
   * duplication defect: `key_assumptions` is a SUBSET of `top_drivers` on every
   * capture measured (3 Aug — identical as sets, 3/3; 25 Aug live wire — 3/3
   * contained). A subset cannot be a distinct answer, so the middle column
   * restated the first one, and the old heading additionally over-claimed: it
   * promised everything the analysis rests on while listing only factor names.
   *
   * `defaulted_assumptions` answers the question the surface was reaching for —
   * *what did Olumi have to assume because we did not tell it?* — and answers it
   * in the producer's own sentence rather than with a third list of labels.
   * `keyAssumptions` is therefore DELIBERATELY DARK on this surface: it is still
   * parsed and contract-guarded, it is simply already on screen one column left.
   */
  const groups = [
    { title: 'What matters', items: brief.topDrivers.map(driver => driver.label), icon: CircleDot, testId: 'decision-brief-drivers' },
    /**
     * ⭐ TWO SOURCES, ONE QUESTION. This group asks "what did Olumi supply that
     * you did not?" and it now has two honest answers:
     *
     *   · `estimatedInterventions` — option→factor EFFECT VALUES the model
     *     chose (`source: 'cee_hypothesis'`), read from the canvas nodes;
     *   · `brief.defaultedAssumptions` — FACTOR STARTING VALUES the producer
     *     defaulted (`source: 'value_defaulted'`), in its own prose.
     *
     * ⚠ THE MODEL-CHOSEN VALUES LEAD, and the order is load-bearing rather than
     * cosmetic: `BriefGroup` previews only `PREVIEW_ITEMS`, and these are the
     * numbers the win probabilities on this very screen were computed from. On
     * the witnessed run `defaultedAssumptions` was EMPTY and this group vanished
     * entirely — while the subtitle above went on promising "the values Olumi
     * assumed". A promise this surface makes and does not keep is worse than
     * silence, which is why the group is fed rather than the subtitle softened.
     *
     * ⚠ THEY ARE NOT MERGED AS A CONCEPT. Two producers, two vocabularies, two
     * readers, joined only at the point of DISPLAY under the heading whose
     * question they both answer (CLAUDE.md trap 21 — name the concepts apart,
     * pick which one the surface consumes). Neither reader knows about the other.
     */
    {
      title: 'What Olumi assumed',
      items: [...estimatedInterventions, ...brief.defaultedAssumptions.map(entry => entry.note)],
      icon: Layers3,
      testId: 'decision-brief-defaulted',
    },
    { title: 'What could change', items: brief.whatWouldChange, icon: GitBranch, testId: 'decision-brief-change' },
  ].filter(group => group.items.length > 0)

  // A brief whose ONLY content is a caveat the verdict does not permit has
  // nothing to show. Returning the shell would frame an empty card as a finding.
  const caveatVisible = leaderClaimPermitted && brief.robustnessCaveat !== null
  if (groups.length === 0 && !caveatVisible) return null

  return (
    <section
      className="rounded-lg border border-panel-border bg-panel px-3 py-2"
      aria-labelledby={`${detailsId}-heading`}
      data-testid="decision-brief-section"
    >
      <div className="flex items-start gap-2">
        <BookOpenText size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {/*
            ⭐ NOT "Decision brief". A user who brought a strategic CHALLENGE —
            "How can I accelerate securing pre-seed investment?" — was being told
            they had a decision brief. Witnessed mounted on exactly that session.

            The heading now describes what the section CONTAINS, which is true
            whether or not the user is deciding anything: the groups below are
            "What matters", "What Olumi assumed", "What could change". It also
            avoids stuttering a fourth "What ..." above those three.

            ⚠ Scope: this is a user-facing label only. `decision-brief-*` testids,
            the directory name and the view-model type keep their legacy names —
            renaming internals here has no user value and would churn every
            consumer (founder's ruling: fix mounted Core language contextually,
            do not globally rename internals).
          */}
          <h3 id={`${detailsId}-heading`} className={`${typography.panelHeader} text-text-header`}>
            Behind this result
          </h3>
          <p className={`${typography.panelMeta} mt-0.5 text-text-light`}>
            Top drivers, the values Olumi assumed, and what could change.
          </p>
        </div>
      </div>

      <dl
        id={detailsId}
        className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-panel-border pt-2"
        data-testid="decision-brief-groups"
      >
        {groups.map(group => (
          <BriefGroup key={group.title} {...group} expanded={expanded} />
        ))}
      </dl>

      {leaderClaimPermitted && brief.robustnessCaveat && (
        <p
          className={`${typography.panelMeta} mt-2 border-t border-panel-border pt-2 text-text-light`}
          data-testid="decision-brief-robustness-caveat"
        >
          {brief.robustnessCaveat.text}
        </p>
      )}

      {groups.some(group => group.items.length > PREVIEW_ITEMS) && (
        <button
          type="button"
          className={`${typography.panelMeta} mt-2 min-h-7 rounded-sm py-1.5 text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(value => !value)}
          data-testid="decision-brief-toggle"
        >
          {expanded ? 'Show brief summary' : 'Show all brief details'}
        </button>
      )}
    </section>
  )
}

/**
 * The complete V5 report already reaches the store and persists with analysis.
 * Reading it here avoids a second mapper and keeps this surface independent of
 * the existing leader/hero authority.
 */
export interface DecisionBriefSectionContainerProps {
  /** See `DecisionBriefSectionProps.leaderClaimPermitted` — passed straight through. */
  leaderClaimPermitted: boolean
}

export function DecisionBriefSectionContainer({ leaderClaimPermitted }: DecisionBriefSectionContainerProps) {
  const rawBrief = useCanvasStore(state => (
    (state.results.report as { decision_brief?: unknown } | null | undefined)?.decision_brief
  ))
  /**
   * ⭐ THE MODEL-CHOSEN VALUES ARE ALREADY CLIENT-SIDE — no new transport, no
   * producer change, no flag. The option nodes carry the producer's own
   * `interventions[factorId].source` stamp, which is the only thing the
   * Inspector's "Estimated by Olumi" can be reading. This is a SELECTOR over
   * state the browser already holds, so the disclosure lands with the analysis
   * rather than waiting on a PLoT→schemas→UI chain.
   *
   * ⚠ A BARE `s.nodes` SELECTOR, NOT A DERIVED ARRAY. Returning
   * `selectEstimatedInterventions(s.nodes)` from inside the store selector would
   * build a NEW array on every store event and re-render this section forever
   * (the React 185 class the repo's `ci:guard:zustand` check exists to catch).
   * The reference-stable slice comes out; the derivation happens in the memo.
   */
  const nodes = useCanvasStore(state => state.nodes)
  const brief = useMemo(() => readDecisionBriefViewModel(rawBrief), [rawBrief])
  const estimatedInterventions = useMemo(
    () => selectEstimatedInterventions(nodes).map(row => row.note),
    [nodes],
  )

  if (!brief) return null
  return (
    <DecisionBriefSection
      brief={brief}
      leaderClaimPermitted={leaderClaimPermitted}
      estimatedInterventions={estimatedInterventions}
    />
  )
}

export default DecisionBriefSectionContainer
