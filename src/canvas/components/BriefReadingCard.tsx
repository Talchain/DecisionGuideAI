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
import { memo } from 'react'
import { typo } from '../../styles/typography'
import { BRIEF_SLOTS, type BriefFields, type BriefSlotKey } from './structuredBrief'

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
  if (slots.every((slot) => (items[slot.key] ?? []).length === 0)) return null
  return (
    <section
      data-testid="brief-reading"
      aria-label="Your brief, as Olumi read it"
      className="w-full max-w-2xl rounded-lg border border-panel-border bg-panel px-4 py-3 flex flex-col gap-2"
    >
      <p className={typo('caption', 'text-text-light m-0')}>Your brief, as Olumi read it</p>
      <dl className="m-0 flex flex-col gap-2">
        {slots.map((slot) => {
          const values = items[slot.key] ?? []
          return (
            <div key={slot.key} data-testid={`brief-reading-${slot.key}`} className="flex flex-col gap-0.5">
              <dt className="flex items-baseline gap-2">
                <span className={typo('labelSmall', 'text-text-body')}>{slot.label}</span>
                {values.length > 0 ? (
                  <span data-testid="brief-reading-your-words" className={typo('caption', 'text-text-light')}>
                    your words
                  </span>
                ) : null}
              </dt>
              {values.length === 0 ? (
                <dd data-testid="brief-reading-not-mentioned" className={typo('bodySmall', 'text-text-light m-0')}>
                  Not mentioned
                </dd>
              ) : values.length === 1 ? (
                <dd className={typo('bodySmall', 'text-text-body m-0 whitespace-pre-line')}>{quoted(values[0])}</dd>
              ) : (
                <dd className="m-0">
                  <ul className="m-0 pl-4 list-disc flex flex-col gap-0.5">
                    {values.map((v) => (
                      <li key={v} className={typo('bodySmall', 'text-text-body')}>
                        {quoted(v)}
                      </li>
                    ))}
                  </ul>
                </dd>
              )}
              {/* "Olumi assumed" items + questions plug in here per slot once CEE sends them (another lane's backend work); none today. */}
            </div>
          )
        })}
      </dl>
    </section>
  )
})
