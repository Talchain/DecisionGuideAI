/**
 * The olumi-core scenario view, as far as the Team tab reads it (API.md v1.7, `GET /api/scenarios/:s`). Only what the panels
 * use is typed; everything else on the view is left alone. Text fields are the members' own words, kept exactly as stored.
 */
export interface TeamMember { readonly id: string; readonly name: string }

/**
 * A figure a member gave with a view, as olumi-core serves it (API.md "Figures on a private view", behind OLUMI_D7): `{ quantity, unit, version, value }`
 * for one number, `{ quantity, unit, version, low, high, range_kind? }` for a range. There is NO `kind`: a point is told from a range by `value`
 * versus `low` and `high` (`readFigure`, model.ts). `unit` and `version` are the unit it was given in and the approved version (`n`) it was given against.
 * `range_kind` is the member's own reading of their range, `bounds` (the ends are hard) or `plausible` (a rough span); a range without it is optional here.
 */
export interface TeamPointFigure { readonly quantity: string; readonly unit?: string | null; readonly version?: number; readonly value: number }
export interface TeamRangeFigure { readonly quantity: string; readonly unit?: string | null; readonly version?: number; readonly low: number; readonly high: number; readonly range_kind?: 'bounds' | 'plausible' }
export type TeamFigure = TeamPointFigure | TeamRangeFigure

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
  readonly measure?: { readonly quantity?: string; readonly frame?: string; readonly aggregation?: string; readonly per?: string | null } | null
}

/** One of the Run's findings, as stored: its `text` is the plain finding and is shown as written. */
export interface TeamFact {
  readonly id: string
  readonly value: string
  readonly text: string
  /** A range finding carries its band as numbers (`low`, `median`, `high`: 8 runs in 10), with its `unit` and the `option` and `goal` it is about. */
  readonly about?: {
    readonly kind?: string; readonly option?: string; readonly goal?: string; readonly low?: number; readonly median?: number; readonly high?: number; readonly unit?: string | null
    /** `'labels'` (OLUMI_LABELS): `text` is `label: item` pairs and is never read; the words are built from `value` and the rest of `about`. */
    readonly form?: string
    /** The ids of what the aim leaves out (a labels fact's provenance block). */
    readonly leaves?: readonly string[]
    /** The block's Olumi flag: true when the finding rests on anything Olumi proposed. */
    readonly olumi?: boolean
  }
}

/**
 * The §3.3 provenance block of a finding (API.md science fields): what the finding rests on that is Olumi's or approximate. D7 carries two, apart: the
 * unchanged model's (`model_side`) and the model with the member's figure (`view_side`). Only what the Team tab reads is typed.
 */
export interface TeamProvenanceBlock {
  readonly olumi?: boolean
  readonly olumi_reading?: boolean
  readonly olumi_figures?: readonly { readonly id: string; readonly approval?: string }[]
  readonly olumi_links?: readonly { readonly id: string; readonly approval?: string }[]
  readonly olumi_mechanisms?: readonly { readonly id: string; readonly approval?: string }[]
  readonly approx_figures?: readonly string[]
  readonly target_by?: string | null
  readonly target_approval?: string | null
  readonly rests?: readonly string[]
}

/** One of D7's facts (API.md "Disagreement as what-ifs"): a member's figure run in the model, one per figure and aim. Read by `about`, never `text`. */
export interface TeamViewFact {
  readonly id: string
  readonly value: string
  readonly text?: string
  readonly about?: {
    readonly kind?: string; readonly form?: string; readonly status?: 'ran' | 'refused' | 'capped' | 'stale'
    readonly holder?: string; readonly quantity?: string; readonly goal?: string; readonly leader?: string | null; readonly model_leader?: string | null
    readonly leader_change?: 'same' | 'reversed' | 'now named' | 'now unnamed'
    readonly options?: readonly { readonly option: string; readonly model: number; readonly view: number; readonly gap?: number; readonly exact?: boolean; readonly model_exact?: boolean; readonly view_exact?: boolean }[]
    readonly figure_by?: string; readonly model_figure_by?: string
    readonly model_side?: TeamProvenanceBlock; readonly view_side?: TeamProvenanceBlock
    readonly olumi?: boolean
    readonly code?: string
  }
}
/** `view_findings` on the scenario view: null before any comparison; current with facts, or stale with a code and NO facts. Only with OLUMI_D7. */
export type TeamViewFindings =
  | { readonly status: 'current'; readonly facts: readonly TeamViewFact[] }
  | { readonly status: 'stale'; readonly code?: string }

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
  /** Present only on a core with OLUMI_D7 on; `null` before any comparison. */
  readonly view_findings?: TeamViewFindings | null
}
