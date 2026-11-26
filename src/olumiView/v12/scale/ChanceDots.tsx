/** A natural frequency picture of Core's served chance. The surrounding words describe it. */
export function ChanceDots({ chance }: { chance?: number | null }) {
  if (typeof chance !== 'number' || !Number.isFinite(chance) || chance < 0 || chance > 1) return null

  const filled = Math.round(chance * 10)
  return (
    <span className="inline-flex shrink-0 gap-[var(--space-1)]" aria-hidden="true" data-chance-dots="">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`size-[var(--space-2)] rounded-full border border-[color:var(--option)] ${i < filled ? 'bg-[color:var(--option)]' : 'bg-transparent'}`}
          data-chance-dot={i < filled ? 'filled' : 'empty'} />
      ))}
    </span>
  )
}
