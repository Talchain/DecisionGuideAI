/**
 * ⭐ C6-2 — "YOUR BRIEF, AS OLUMI READ IT": the user's own words, in four slots, while a first brief is drafted.
 *
 * A first brief waits ~60 s for its model on the first-use screen. This card lays the brief out in the four
 * "Structure it" slots (Context · Goal · Options · Things to consider) and fills each ONLY with the user's words:
 * - sent from the "Structure it" fields → the user's own four fields, verbatim;
 * - sent from the single box → CEE's `BRIEF_READ` frame: `goal` → Goal, `options` → Options, `limits` → Things to
 *   consider. Each is an exact substring of what the user typed (CEE drops any span that is not). CEE sends no
 *   context span, so on this path the Context slot is left out rather than claiming "Not mentioned" over a brief
 *   that may well give context.
 * A filled slot is marked "your words"; an empty one reads "Not mentioned". No leader, no ranking, nothing Olumi
 * inferred (AIQ #70 5858767026), and never the word "model". It lives only while the turn is drafting
 * (`draftStore.draftStreamBriefReading`); the model supersedes it.
 */
import { memo, useState } from 'react'
import { GitFork, Globe, History, Ruler, Target, type LucideIcon } from 'lucide-react'
import { typo } from '../../styles/typography'
import { BRIEF_SLOTS, type BriefFields, type BriefSlotKey } from './structuredBrief'
import { briefCoachingFor, queueBriefCoachingPrefill, type BriefCoachingId } from './briefCoaching'
import { NodeShape } from '../conversation/primitives/NodeShape'
import type { NodeType } from '../domain/nodes'

export interface BriefReadingCardProps {
  /** CEE's `BRIEF_READ` spans (single-box sends). */
  reading: { goal: string | null; options: string[]; limits?: string[] } | null
  /** The user's own "Structure it" fields, when the brief was sent from them. Wins over `reading`. */
  userFields?: BriefFields | null
}

const quoted = (span: string) => `“${span}”`

type SlotItems = Partial<Record<BriefSlotKey, string[]>>

function slotItems(reading: BriefReadingCardProps['reading'], userFields: BriefFields | null): SlotItems {
  if (userFields) {
    const items: SlotItems = {}
    for (const slot of BRIEF_SLOTS) {
      const value = userFields[slot.key].trim()
      items[slot.key] = value.length > 0 ? [value] : []
    }
    return items
  }
  if (reading === null) return {}
  return {
    goal: reading.goal !== null ? [reading.goal] : [],
    options: reading.options,
    considerations: reading.limits ?? [],
  }
}

/** Each brief row is keyed by the canvas shape it becomes, so the brief and the model share one vocabulary. */
const SLOT_SHAPE: Record<BriefSlotKey, NodeType> = {
  context: 'decision',
  goal: 'goal',
  options: 'option',
  considerations: 'factor',
}

/** One icon per habit, from the product's icon library (lucide), never drawn by hand. */
const COACHING_ICON: Record<BriefCoachingId, LucideIcon> = {
  goal: Target,
  limits: Ruler,
  options: GitFork,
  pre_mortem: History,
  outside_view: Globe,
}

/** Columns the habits fill exactly: two habits never leave an empty third column. */
const HABIT_COLUMNS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }


export const BriefReadingCard = memo(function BriefReadingCard({ reading, userFields = null }: BriefReadingCardProps) {
  const items = slotItems(reading, userFields)
  const slots = BRIEF_SLOTS.filter((slot) => items[slot.key] !== undefined)
  const [queuedId, setQueuedId] = useState<BriefCoachingId | null>(null)
  if (slots.every((slot) => (items[slot.key] ?? []).length === 0)) return null
  const coaching = briefCoachingFor({
    hasGoal: (items.goal ?? []).length > 0,
    hasLimits: (items.considerations ?? []).length > 0,
    // CEE's spans are one per option, so they count; the user's own Options field is one box of free text, so the
    // count is unknown unless it is empty (`briefCoaching`'s `BriefShape.optionCount`).
    optionCount: userFields ? ((items.options ?? []).length === 0 ? 0 : null) : (items.options ?? []).length,
  })
  return (
    <section data-testid="brief-reading" aria-label="Your brief" className="border-t border-panel-border">
      {/* ⭐ PAUL, 7 OCT 2026, of this screen: "The layout looks terrible… How can you really enhance it so it looks
          premium?" This card is now the lower half of ONE drafting sheet (`FirstUseDraftingSheet`), not a second card
          of its own.
          - Each row is keyed by the canvas shape it becomes.
          - Options sit as numbered chips, numbered as the canvas numbers them.
          - The habits are equal cards: icon, title, one line of why, the source, and the action at the same height.
          Paul's 1 Oct rules still hold: one 14px type size, only the user's words, an empty slot said plainly,
          nothing inferred. */}
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-8 sm:py-6">
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className={typo('label', 'text-text-header m-0')}>Your brief</h2>
          <span data-testid="brief-reading-your-words" className={typo('bodySmall', 'text-text-light')}>
            Quoted in your words
          </span>
        </header>
        <dl className="m-0 grid grid-cols-1 gap-y-1.5 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-x-5 sm:gap-y-3.5">
          {slots.map((slot) => {
            const values = items[slot.key] ?? []
            return (
              <div key={slot.key} data-testid={`brief-reading-${slot.key}`} className="contents">
                <dt className={typo('bodySmall', 'text-text-light m-0 flex items-center gap-2.5 sm:min-h-[28px]')}>
                  <NodeShape kind={SLOT_SHAPE[slot.key]} size={12} />
                  {slot.label}
                </dt>
                {values.length === 0 ? (
                  <dd data-testid="brief-reading-not-mentioned" className={typo('bodySmall', 'text-text-light m-0 mb-2 sm:mb-0 sm:py-1')}>
                    Not stated yet
                  </dd>
                ) : slot.key === 'options' && !userFields ? (
                  <dd className="m-0 mb-2 min-w-0 sm:mb-0">
                    <ol className="m-0 p-0 list-none flex flex-wrap gap-2">
                      {values.map((v, i) => (
                        <li
                          key={v}
                          className={typo(
                            'bodySmall',
                            'text-text-header inline-flex max-w-full items-center gap-2 rounded-lg border border-option/40 bg-option-light/50 py-1 pl-1 pr-2.5',
                          )}
                        >
                          <span aria-hidden="true" className="tabular-nums font-medium text-text-body rounded-md bg-option/30 px-1.5">
                            {i + 1}
                          </span>
                          <span className="min-w-0">{quoted(v)}</span>
                        </li>
                      ))}
                    </ol>
                  </dd>
                ) : values.length === 1 ? (
                  <dd className={typo('bodySmall', 'text-text-header m-0 mb-2 min-w-0 whitespace-pre-line sm:mb-0 sm:py-1')}>{quoted(values[0])}</dd>
                ) : (
                  <dd className="m-0 mb-2 min-w-0 sm:mb-0 sm:py-1">
                    <ul className="m-0 p-0 list-none flex flex-col gap-1">
                      {values.map((v) => (
                        <li key={v} className={typo('bodySmall', 'text-text-header')}>{quoted(v)}</li>
                      ))}
                    </ul>
                  </dd>
                )}
              </div>
            )
          })}
        </dl>
      </div>
      <div data-testid="brief-coaching" className="flex flex-col gap-4 border-t border-panel-border bg-panel-hover/60 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-0.5">
          <h3 className={typo('label', 'text-text-header m-0')}>While Olumi builds: sharpen the decision</h3>
          <p className={typo('bodySmall', 'text-text-light m-0')}>
            Research-backed habits. Pick one and Olumi starts there when your draft is ready.
          </p>
        </div>
        <ul className={`m-0 p-0 list-none grid grid-cols-1 gap-3 ${HABIT_COLUMNS[coaching.length] ?? 'sm:grid-cols-3'}`}>
          {coaching.map((card) => {
            const queued = queuedId === card.id
            const Icon = COACHING_ICON[card.id]
            return (
              <li
                key={card.id}
                data-testid={`brief-coaching-${card.id}`}
                className={`flex flex-col gap-2 rounded-xl border bg-panel p-4 transition-colors ${
                  queued ? 'border-info/50' : 'border-panel-border hover:border-border-emphasis'
                }`}
              >
                <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-info-light/60 text-info-ink">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <p className={typo('label', 'text-text-header m-0 mt-1')}>{card.title}</p>
                <p className={typo('bodySmall', 'text-text-body m-0 flex-1')}>{card.why}</p>
                <p data-testid={`brief-coaching-source-${card.id}`} className={typo('bodySmall', 'text-text-light m-0')}>
                  {card.source}
                </p>
                <button
                  type="button"
                  aria-pressed={queued}
                  data-testid={`brief-coaching-action-${card.id}`}
                  onClick={() => {
                    queueBriefCoachingPrefill(card.prefill)
                    setQueuedId(card.id)
                  }}
                  className={`${typo('bodySmall')} mt-1 w-full rounded-lg border px-3 py-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                    queued ? 'border-info bg-info text-text-on-color' : 'border-border-emphasis bg-panel text-text-body hover:bg-panel-hover'
                  }`}
                >
                  {queued ? 'Ready when the draft lands' : card.actionLabel}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
})
