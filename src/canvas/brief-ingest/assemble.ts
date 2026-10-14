import { BRIEF_CHAR_BUDGET, MAX_UNITS } from './limits'
import { BriefIngestError, type Extraction, type Segment } from './types'
import { cleanFilename } from './cleanFilename'

export interface AssembledBrief {
  /** The whole new brief: the user's text, untouched, then the file's text. */
  text: string
  /** Exactly the block that was appended (for "Remove what was added"). */
  added: string
  /** Plain count line, e.g. "Olumi read 9 of 40 slides (2 were images)." */
  summary: string
}

const SEPARATOR = '\n\n'
/** Room kept for the cut-off note when the budget bites. */
const CUT_NOTE_RESERVE = 220

const line = (s: Segment) => (s.text ? `[${s.marker}] ${s.text}` : `[${s.marker}]`)

/**
 * Puts a file's located segments into the brief, APPENDED to what the user
 * already wrote and never replacing it. Every cut is at a segment boundary
 * (never mid-row or mid-slide) and is said in the box itself.
 */
export function assembleBrief(existing: string, filename: string, extraction: Extraction): AssembledBrief {
  const header = `From ${cleanFilename(filename)}:`
  const notes = [...extraction.notes]
  let segments = extraction.segments

  if (extraction.unitCapped) {
    const units = segments.filter((s) => s.unit !== undefined).map((s) => s.unit as number)
    const lastUnit = units.length ? Math.max(...units) : 0
    if (lastUnit > MAX_UNITS || extraction.total > MAX_UNITS) {
      segments = segments.filter((s) => s.unit === undefined || s.unit <= MAX_UNITS)
      const noun = extraction.noun[1]
      notes.unshift(`(Olumi read ${noun} 1–${MAX_UNITS} of ${extraction.total}; the rest were not read)`)
    }
  }

  if (!segments.some((s) => s.countable)) {
    const why = notes.length ? ` ${notes.join(' ')}` : ''
    throw new BriefIngestError(`Olumi found no text it could read in this file.${why}`)
  }

  const prefix = existing.trim() ? SEPARATOR : ''
  const room = BRIEF_CHAR_BUDGET - existing.length - prefix.length
  const build = (segs: Segment[], extraNotes: string[]) =>
    [header, ...segs.map(line), ...extraNotes, ...notes].join('\n')

  let kept = segments
  let added = build(kept, [])
  if (added.length > room) {
    const limit = room - CUT_NOTE_RESERVE
    kept = []
    let length = [header, ...notes].join('\n').length
    for (const s of segments) {
      const next = length + 1 + line(s).length
      if (next > limit) break
      kept.push(s)
      length = next
    }
    if (!kept.some((s) => s.countable)) {
      throw new BriefIngestError(
        `Your brief is already near the ${BRIEF_CHAR_BUDGET.toLocaleString('en-GB')}-character limit, so there is no room to add this file.`,
      )
    }
    const last = kept[kept.length - 1]
    added = build(kept, [
      `(Olumi read up to [${last.marker}]; the rest of the file was not read, because a brief holds up to ${BRIEF_CHAR_BUDGET.toLocaleString('en-GB')} characters)`,
    ])
  }

  const read = kept.filter((s) => s.countable).length
  const extra = extraction.extra ? ` (${extraction.extra})` : ''
  const noun = extraction.total === 1 ? extraction.noun[0] : extraction.noun[1]
  const summary = `Olumi read ${read} of ${extraction.total} ${noun}${extra}.`
  return { text: existing + prefix + added, added: prefix + added, summary }
}
