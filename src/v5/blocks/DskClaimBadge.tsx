import { BookOpenCheck } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { V5DskClaimProvenance } from '../../canvas/conversation/types'

export function DskClaimBadge({ claim, testId }: { claim: V5DskClaimProvenance; testId: string }) {
  return (
    <p
      data-testid={testId}
      data-dsk-claim-id={claim.claim_id}
      data-dsk-evidence-strength={claim.evidence_strength}
      {...(claim.protocol_id ? { 'data-dsk-protocol-id': claim.protocol_id } : {})}
      className={`${typography.chatMeta} flex items-center gap-x-1.5 text-text-light`}
    >
      <BookOpenCheck size={12} className="flex-none text-info" aria-hidden="true" />
      <span>
        Grounded in decision science · {claim.evidence_strength} evidence
      </span>
    </p>
  )
}
