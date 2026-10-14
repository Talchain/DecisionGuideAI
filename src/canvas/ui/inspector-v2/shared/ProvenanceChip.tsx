import { typography } from '../../../../styles/typography'

export type ProvenanceKind = 'brief' | 'olumi' | 'user' | 'example' | 'unsized'

const PROVENANCE = {
  brief: { label: 'From your brief', border: 'border-info/30' },
  olumi: { label: "Olumi's estimate", border: 'border-info/30' },
  user: { label: 'Yours', border: 'border-success/30' },
  example: { label: 'Example figure', border: 'border-warning/30' },
  unsized: { label: 'Not sized yet', border: 'border-text-light/30' },
} satisfies Record<ProvenanceKind, { label: string; border: string }>

export function ProvenanceChip({ kind }: { kind?: ProvenanceKind | string | null }) {
  if (!kind || !Object.prototype.hasOwnProperty.call(PROVENANCE, kind)) return null
  const provenance = PROVENANCE[kind as ProvenanceKind]

  return (
    <span
      data-testid="inspector-provenance-chip"
      data-provenance={kind}
      className={`${typography.panelMeta} inline-flex rounded-full border ${provenance.border} bg-transparent px-2 py-0.5 text-text-body`}
    >
      {provenance.label}
    </span>
  )
}
