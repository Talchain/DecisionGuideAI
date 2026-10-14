/** One located piece of the file. Rendered as `[marker] text`. */
export interface Segment {
  marker: string
  text: string
  /** Slide or page number, for the slide/page cap. */
  unit?: number
  /** Counts toward "Olumi read N of M <noun>" (rows, slides, paragraphs). */
  countable: boolean
}

export interface Extraction {
  segments: Segment[]
  /** What was NOT read, as plain sentences in brackets. */
  notes: string[]
  /** Noun for the count line as [one, many], e.g. ['slide', 'slides']. */
  noun: readonly [string, string]
  /** Total countable things in the file, read or not. */
  total: number
  /** Extra clause for the count line, e.g. "2 were images". */
  extra?: string
  /** True when the slide/page cap applies. */
  unitCapped?: boolean
}

/** An error whose message is written for the user and safe to show as is. */
export class BriefIngestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BriefIngestError'
  }
}
