/**
 * "STRUCTURE IT" — the four labelled parts of a first brief, and the ONE text they compose into.
 *
 * The first-use hero offers four short fields as an alternative to its single box. On send they become one brief
 * with plain labelled lines ("Context: …\nGoal: …") and travel the single box's own send path: no new wire field,
 * no backend change. Empty fields are left out. `readStructuredBrief` reads that same labelled form back into the
 * fields (so switching box ↔ fields never loses text); it only recognises the four labels this module writes and
 * never guesses which sentence of free text is a goal.
 */

export type BriefSlotKey = 'context' | 'goal' | 'options' | 'considerations'

export type BriefFields = Record<BriefSlotKey, string>

export interface BriefSlot {
  key: BriefSlotKey
  /** Written into the composed brief as `${label}: …`, and the slot's heading everywhere. */
  label: string
  /** Short helper line under the field label. */
  hint?: string
}

export const BRIEF_SLOTS: readonly BriefSlot[] = [
  { key: 'context', label: 'Context' },
  { key: 'goal', label: 'Goal', hint: 'What success looks like, and by when' },
  { key: 'options', label: 'Options' },
  { key: 'considerations', label: 'Things to consider', hint: 'Limits, risks' },
]

export const EMPTY_BRIEF_FIELDS: BriefFields = { context: '', goal: '', options: '', considerations: '' }

/** One labelled line per non-empty field, in slot order. Empty string when every field is empty. */
export function composeStructuredBrief(fields: BriefFields): string {
  return BRIEF_SLOTS.map((slot) => ({ slot, value: fields[slot.key].trim() }))
    .filter(({ value }) => value.length > 0)
    .map(({ slot, value }) => `${slot.label}: ${value}`)
    .join('\n')
}

/**
 * Reads text in the composed form back into fields. Null when the text does not start with one of the four labels
 * or repeats one — the caller then keeps the text whole rather than splitting it by guesswork.
 */
export function readStructuredBrief(text: string): BriefFields | null {
  const fields: BriefFields = { ...EMPTY_BRIEF_FIELDS }
  const seen = new Set<BriefSlotKey>()
  let current: BriefSlotKey | null = null
  for (const line of text.split('\n')) {
    const slot = BRIEF_SLOTS.find((s) => line.startsWith(`${s.label}:`))
    if (slot) {
      if (seen.has(slot.key)) return null
      seen.add(slot.key)
      current = slot.key
      fields[slot.key] = line.slice(slot.label.length + 1).trim()
    } else if (current !== null) {
      fields[current] = `${fields[current]}\n${line}`
    } else if (line.trim().length > 0) {
      return null
    }
  }
  for (const key of seen) fields[key] = fields[key].trim()
  return fields
}
