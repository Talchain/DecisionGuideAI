import { FIELD, LABEL } from './ui'

/** The words of the one review-date field both commitment forms draw (the Team tab's and "Record what you will do"). */
export const REVIEW_ON_LABEL = 'When to review it (optional)'

/**
 * A commitment's optional review date: a calendar date the person picks, sent as `review_on` (core checks only that it is a real date,
 * with or without an approved version: record-writes.ts commit). One field for both forms, which share one draft, so a date picked in
 * either is the same date.
 */
export function ReviewOnField({ id, value, disabled, onChange }: { id: string; value: string; disabled: boolean; onChange: (v: string) => void }): JSX.Element {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className={LABEL}>{REVIEW_ON_LABEL}</label>
      <input id={id} type="date" data-testid={id} className={FIELD} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
