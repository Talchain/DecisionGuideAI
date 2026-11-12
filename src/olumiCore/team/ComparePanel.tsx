import type { View } from '../../olumiView/client'
import { CoreCompare, useLatestApproved } from '../compare'
import { BODY, H, META } from './ui'

/**
 * THE TEAM'S RECORD AND HOW THE MODEL MOVED (PL review, 4 Nov: both already on core). Compare any two approved versions through core's
 * read-only compare route (`../compare.tsx`), and open core's printable reasoning record. Nothing is computed here.
 */
export function ComparePanel({ sid, view }: { sid: string; view: View }): JSX.Element | null {
  // The latest approved version, not the one drawn: an earlier version on the canvas leaves every version to compare (R1 review 2).
  const latest = useLatestApproved()
  if (latest === null || latest === undefined || view.version === null) return null
  return (
    <section data-testid="team-review" aria-label="Record and versions" className="grid gap-2">
      <h3 className={H}>Record and versions</h3>
      <p className={META}>
        <a href={`/s/${encodeURIComponent(sid)}/record`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[24px] items-center text-info underline underline-offset-2" data-testid="team-record-link">Printable record</a>
      </p>
      {latest < 2 ? null : (
        <details data-testid="team-compare">
          <summary className={BODY}>Compare versions</summary>
          <div className="mt-2"><CoreCompare sid={sid} latest={latest} id="team-compare" /></div>
        </details>
      )}
    </section>
  )
}
