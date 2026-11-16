import { FileText, User } from 'lucide-react'

/**
 * V12 Sprint-Differ, the mark on a driver card: "You differ here: the evidence behind this figure". Two person marks (the two who differ,
 * never more than two drawn: the chip's words name everyone) and, when evidence is what they differ on, an evidence glyph. Decoration only:
 * the chip it sits in carries core's words (aria-label, title). People are drawn as marks, never initials, so no one is named by the shape.
 */
export function DriverDifferMark({ people, evidence }: { people: readonly { readonly id: string | number }[]; evidence: boolean }): JSX.Element | null {
  const two = people.slice(0, 2)
  if (two.length < 2) return null
  return (
    <span aria-hidden="true" className="inline-flex flex-none items-center gap-1" data-testid="driver-differ-mark">
      <span className="inline-flex">
        {two.map((p, i) => (
          <span key={p.id} data-differ-person={p.id}
            className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-panel-border bg-canvas text-text-body ${i > 0 ? '-ml-1.5' : ''}`}>
            <User strokeWidth={1.75} className="h-3 w-3" />
          </span>
        ))}
      </span>
      {evidence && <FileText strokeWidth={1.75} className="h-3 w-3 text-text-body" data-differ-evidence="" />}
    </span>
  )
}
