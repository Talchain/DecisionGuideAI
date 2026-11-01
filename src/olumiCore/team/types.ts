/**
 * The olumi-core scenario view, as far as the Team tab reads it (API.md v1.7, `GET /api/scenarios/:s`). Only what the panels
 * use is typed; everything else on the view is left alone. Text fields are the members' own words, kept exactly as stored.
 */
export interface TeamMember { readonly id: string; readonly name: string }

/** A figure a member gave with a view: one number, or a range given by its two ends. Served only when core preserves it. */
export type TeamFigure =
  | { readonly kind: 'point'; readonly quantity: string; readonly value: number }
  | { readonly kind: 'interval'; readonly quantity: string; readonly low: number; readonly high: number }

export interface TeamViewRow {
  readonly id: number
  readonly by: string
  readonly mine: boolean
  readonly revealed: boolean
  readonly text: string
  readonly skip: boolean
  /** Present only on a core that serves figures; absent on 2b84912. */
  readonly figures?: readonly TeamFigure[]
}

export interface TeamEvidenceRow {
  readonly id: number
  readonly at: string
  readonly by: string
  readonly text: string
  readonly source: string | null
  readonly concerns: readonly string[]
  readonly stance: 'supports' | 'challenges' | 'unclear'
  readonly version: number | null
}

export interface TeamOutcomeRow {
  readonly id: number
  readonly at: string
  readonly by: string
  readonly happened: string
  readonly versus: OutcomeVersus
  readonly reconsider_triggered: boolean
  readonly note: string | null
}
export type OutcomeVersus = 'as_expected' | 'better' | 'worse' | 'mixed' | 'unclear'

export interface TeamCommitmentRow {
  readonly id: number
  readonly at: string
  readonly by: string
  readonly action: string
  /** The owner's name; `owner_id` is the member id a write takes. */
  readonly owner: string
  readonly owner_id: string
  readonly expect: string
  readonly reconsider: string
  readonly keeps: readonly string[]
  readonly outcomes: readonly TeamOutcomeRow[]
}

/** A record of the approved model, whatever its family: the fields the panels read for a label. */
export interface TeamRecord {
  readonly id: string
  readonly family: string
  readonly label?: string
  readonly text?: string
  readonly holder?: string
  readonly position?: string
  readonly origin?: { readonly by: string; readonly quote?: string; readonly party?: string | null }
  /** A goal's or limit's measure: what it measures (a record id). */
  readonly measure?: { readonly quantity?: string } | null
}

/** One of the Run's findings, as stored: its `text` is the plain finding and is shown as written. */
export interface TeamFact {
  readonly id: string
  readonly value: string
  readonly text: string
  /** A range finding carries its band as numbers (`low`, `median`, `high`: 8 runs in 10), with its `unit` and the `option` and `goal` it is about. */
  readonly about?: { readonly kind?: string; readonly option?: string; readonly goal?: string; readonly low?: number; readonly median?: number; readonly high?: number; readonly unit?: string | null }
}

export interface TeamScenario {
  readonly id: string
  readonly title?: string
  readonly you: string
  readonly members: readonly TeamMember[]
  readonly views: readonly TeamViewRow[]
  readonly waiting: readonly string[]
  readonly reveal: { readonly state: 'open' | 'ready' | 'revealed'; readonly at: string | null }
  readonly commitments: readonly TeamCommitmentRow[]
  readonly evidence: readonly TeamEvidenceRow[]
  readonly version: null | { readonly id: number; readonly n: number; readonly form: { readonly records: readonly TeamRecord[] }; readonly facts?: readonly TeamFact[] }
  readonly pending: null | { readonly id: number }
}
