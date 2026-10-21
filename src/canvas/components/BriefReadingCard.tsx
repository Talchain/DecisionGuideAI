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
 * A filled slot is quoted; an empty one reads "Not stated yet". No leader, no ranking, nothing Olumi inferred
 * (AIQ #70 5858767026), and never the word "model". It lives only while the turn is drafting
 * (`draftStore.draftStreamBriefReading`); the model supersedes it.
 *
 * Below the brief sits ONE question about it that the user can answer in the wait (`briefCoaching`).
 */
import { memo, useId, useState } from 'react'
import { Check } from 'lucide-react'
import { typo } from '../../styles/typography'
import { Button } from '../../components/ui/Button'
import { BRIEF_SLOTS, type BriefFields, type BriefSlotKey } from './structuredBrief'
import { briefPromptFor, briefPromptPrefill, queueBriefCoachingPrefill, type BriefPrompt } from './briefCoaching'
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

/**
 * The one question, answered in place. Typing queues the pre-fill at once, so an answer is never lost to a draft
 * that lands mid-sentence; "Add" confirms it. Nothing is sent.
 */
const BriefPromptField = memo(function BriefPromptField({ prompt }: { prompt: BriefPrompt }) {
  const inputId = useId()
  const [answer, setAnswer] = useState('')
  const [added, setAdded] = useState(false)
  const update = (value: string) => {
    setAnswer(value)
    queueBriefCoachingPrefill(briefPromptPrefill(prompt, value))
  }
  return (
    <div data-testid="brief-prompt" data-prompt={prompt.id} className="flex flex-col gap-3 rounded-md border border-panel-border p-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={inputId} className={typo('label', 'text-text-header')}>
          {prompt.question}
        </label>
        <p className={typo('bodySmall', 'text-text-light m-0')}>{prompt.why}</p>
      </div>
      {added ? (
        <div className="flex items-center justify-between gap-3">
          <div data-testid="brief-prompt-added" role="status" className="flex min-w-0 items-start gap-2">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            <p className={typo('bodySmall', 'text-text-body m-0 min-w-0')}>
              Added {quoted(answer.trim())}.{' '}
              <span className="text-text-light">It will be waiting in your message to Olumi once the draft is ready.</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" data-testid="brief-prompt-change" onClick={() => setAdded(false)}>
            Change
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (answer.trim()) setAdded(true)
          }}
        >
          <input
            id={inputId}
            data-testid="brief-prompt-input"
            value={answer}
            onChange={(e) => update(e.target.value)}
            placeholder={prompt.placeholder}
            className={typo(
              'bodySmall',
              'min-h-[44px] min-w-0 flex-1 rounded-sm border border-border-emphasis bg-panel px-4 text-text-header placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
            )}
          />
          <Button type="submit" size="sm" data-testid="brief-prompt-submit" disabled={!answer.trim()}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
})

export const BriefReadingCard = memo(function BriefReadingCard({ reading, userFields = null }: BriefReadingCardProps) {
  const items = slotItems(reading, userFields)
  const slots = BRIEF_SLOTS.filter((slot) => items[slot.key] !== undefined)
  if (slots.every((slot) => (items[slot.key] ?? []).length === 0)) return null
  const prompt = briefPromptFor({
    hasGoal: (items.goal ?? []).length > 0,
    hasLimits: (items.considerations ?? []).length > 0,
    // CEE's spans are one per option, so they count; the user's own Options field is one box of free text, so the
    // count is unknown unless it is empty (`briefCoaching`'s `BriefShape.optionCount`).
    optionCount: userFields ? ((items.options ?? []).length === 0 ? 0 : null) : (items.options ?? []).length,
  })
  return (
    <section data-testid="brief-reading" aria-label="Your brief" className="flex flex-col gap-4 px-5 pb-5 sm:px-8 sm:pb-6">
      {/* ⭐ PAUL, 21 OCT 2026, of this screen: "a lot of text and not a lot of useful functionality … cut off at the
          bottom". The brief is a compact read-back and the habit cards are ONE question about this brief, answered in
          place, so the sheet fits one viewport. Paul's 1 Oct rules still hold: one 14px type size, only the user's
          words, an empty slot said plainly, nothing inferred. DS v5: outlined pills, no tinted containers, no
          decorative icons. */}
      <div className="flex flex-col gap-2.5">
        <h2 className={typo('label', 'text-text-header m-0')}>Your brief</h2>
        <dl className="m-0 grid grid-cols-1 gap-y-1 sm:grid-cols-[148px_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2">
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
                            'text-text-body inline-flex max-w-full items-baseline gap-1.5 rounded-pill border border-option/30 bg-transparent px-3 py-0.5',
                          )}
                        >
                          <span aria-hidden="true" className="tabular-nums text-text-light">{i + 1}</span>
                          <span className="min-w-0">{quoted(v)}</span>
                        </li>
                      ))}
                    </ol>
                  </dd>
                ) : values.length === 1 ? (
                  <dd title={values[0]} className={typo('bodySmall', 'text-text-header m-0 mb-2 min-w-0 whitespace-pre-line line-clamp-3 sm:mb-0 sm:py-1')}>{quoted(values[0])}</dd>
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
      <BriefPromptField key={prompt.id} prompt={prompt} />
    </section>
  )
})
