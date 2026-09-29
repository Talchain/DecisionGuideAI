/**
 * StructuredBriefFields — the first-use hero's "Structure it" input: four short labelled fields in place of the
 * single box. It owns no text; the hero holds the fields and composes them into ONE brief on send
 * (`structuredBrief.ts`), which then goes out through the single box's own send path.
 */
import { memo, type KeyboardEvent } from 'react'
import { typo } from '../../styles/typography'
import { Button } from '../../components/ui/Button'
import { BRIEF_SLOTS, type BriefFields, type BriefSlotKey } from './structuredBrief'

export interface StructuredBriefFieldsProps {
  fields: BriefFields
  onChange: (key: BriefSlotKey, value: string) => void
  onSend: () => void
  canSend: boolean
}

export const StructuredBriefFields = memo(function StructuredBriefFields({
  fields,
  onChange,
  onSend,
  canSend,
}: StructuredBriefFieldsProps) {
  // Enter keeps its newline in a field; Cmd/Ctrl+Enter sends, as a multi-field form usually does.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
      e.preventDefault()
      onSend()
    }
  }
  return (
    <div
      data-testid="structured-brief"
      className="w-full flex flex-col gap-3 rounded-lg border border-panel-border bg-panel px-4 py-3"
    >
      {BRIEF_SLOTS.map((slot, i) => (
        <label key={slot.key} className="flex flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={typo('label', 'text-text-body')}>{slot.label}</span>
            {slot.hint ? <span className={typo('caption', 'text-text-light')}>{slot.hint}</span> : null}
          </span>
          <textarea
            data-testid={`structured-brief-${slot.key}`}
            value={fields[slot.key]}
            onChange={(e) => onChange(slot.key, e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            autoFocus={i === 0}
            className={typo(
              'bodySmall',
              'w-full resize-y rounded-md border border-panel-border bg-transparent px-3 py-2 text-text-body outline-none focus:border-info',
            )}
          />
        </label>
      ))}
      <div className="flex justify-end">
        <Button size="sm" onClick={onSend} disabled={!canSend} data-testid="structured-brief-send">
          Send
        </Button>
      </div>
    </div>
  )
})
