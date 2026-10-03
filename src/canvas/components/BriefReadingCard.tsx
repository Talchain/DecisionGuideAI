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
import { typo } from '../../styles/typography'
import { BRIEF_SLOTS, type BriefFields, type BriefSlotKey } from './structuredBrief'
import { briefCoachingFor, queueBriefCoachingPrefill, type BriefCoachingId } from './briefCoaching'

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
    <section
      data-testid="brief-reading"
      aria-label="Your brief"
      className="w-full max-w-2xl rounded-xl border border-panel-border bg-panel shadow-1 px-5 py-4 flex flex-col gap-4"
    >
      {/* ⭐ PAUL, 1 OCT 2026: "The formatting of the panel that outlines the brief while the model is being generated
          still isn't correct. It looks bad, and there are no science-grounded coaching opportunities."
          - Before: four stacked label/value blocks, each re-tagged "your words".
          - Now: one quiet two-column reading (label | the user's own words, quoted, with options numbered as the
            canvas numbers them), then up to three research-backed habits to act on while the draft is built.
          - The honesty rules are unchanged: only the user's words, an empty slot said plainly, nothing inferred. */}
      <header className="flex items-baseline justify-between gap-3">
        <h2 className={typo('label', 'text-text-header m-0')}>Your brief</h2>
        <span data-testid="brief-reading-your-words" className={typo('bodySmall', 'text-text-light')}>
          Quoted in your words
        </span>
      </header>
      <dl className="m-0 grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-2.5">
        {slots.map((slot) => {
          const values = items[slot.key] ?? []
          return (
            <div key={slot.key} data-testid={`brief-reading-${slot.key}`} className="contents">
              <dt className={typo('bodySmall', 'text-text-light m-0')}>{slot.label}</dt>
              {values.length === 0 ? (
                <dd data-testid="brief-reading-not-mentioned" className={typo('bodySmall', 'text-text-light m-0')}>
                  Not stated yet
                </dd>
              ) : slot.key === 'options' && !userFields ? (
                <dd className="m-0">
                  <ol className="m-0 p-0 list-none flex flex-col gap-1">
                    {values.map((v, i) => (
                      <li key={v} className={typo('bodySmall', 'text-text-body flex gap-2')}>
                        <span aria-hidden="true" className="tabular-nums text-text-light">{i + 1}</span>
                        <span>{quoted(v)}</span>
                      </li>
                    ))}
                  </ol>
                </dd>
              ) : values.length === 1 ? (
                <dd className={typo('bodySmall', 'text-text-body m-0 whitespace-pre-line')}>{quoted(values[0])}</dd>
              ) : (
                <dd className="m-0">
                  <ul className="m-0 p-0 list-none flex flex-col gap-1">
                    {values.map((v) => (
                      <li key={v} className={typo('bodySmall', 'text-text-body')}>{quoted(v)}</li>
                    ))}
                  </ul>
                </dd>
              )}
            </div>
          )
        })}
      </dl>
      <div data-testid="brief-coaching" className="border-t border-panel-border pt-3.5 flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h3 className={typo('label', 'text-text-header m-0')}>While Olumi builds: sharpen the decision</h3>
          <p className={typo('bodySmall', 'text-text-light m-0')}>
            Research-backed habits. Pick one and Olumi starts there when your draft is ready.
          </p>
        </div>
        {/* One quiet list, not a stack of boxes (Paul 1 Oct: "easy to digest"): a hairline between habits, each one
            title, one line of why with its source muted after it, and one action. */}
        <ul className="m-0 p-0 list-none flex flex-col divide-y divide-panel-border">
          {coaching.map((card) => {
            const queued = queuedId === card.id
            return (
              <li
                key={card.id}
                data-testid={`brief-coaching-${card.id}`}
                className="flex items-center gap-3 py-2.5 first:pt-1"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <p className={typo('label', 'text-text-header m-0')}>{card.title}</p>
                  <p className={typo('bodySmall', 'text-text-body m-0')}>
                    {card.why}{' '}
                    <span data-testid={`brief-coaching-source-${card.id}`} className="text-text-light">
                      {card.source}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={queued}
                  data-testid={`brief-coaching-action-${card.id}`}
                  onClick={() => {
                    queueBriefCoachingPrefill(card.prefill)
                    setQueuedId(card.id)
                  }}
                  className={`${typo('bodySmall')} shrink-0 rounded-full border px-3 py-1 transition-colors ${
                    queued ? 'border-text-body bg-panel-hover text-text-body' : 'border-text-light text-text-body hover:bg-panel-hover'
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
