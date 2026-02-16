/**
 * Header - Pre-Analysis Panel inline status line
 *
 * Single text line with tier counts:
 * - Loading: "◌ Checking..." in text-light color (while CEE data loads)
 * - Blocked: "⊘ Blocked · {mustAddress.count} to address" in danger color
 * - Not ready: "◌ Not ready" in warning color (when isReady=false but no mustAddress items)
 * - Ready: "✓ Ready · {review.count} to review · Improvements available" in success color
 *
 * Omits tiers with zero count.
 * 14px, font-weight 600, no background/border/padding beyond panel's own.
 *
 * Sync note: Header and StickyFooter both derive from the same usePreAnalysisData() hook.
 * isReady = existingReadiness.canRun && tiers.mustAddress.count === 0
 * hasBlockers = tiers.mustAddress.count > 0
 * When isReady=false AND mustAddressCount=0, it means canRun failed for reasons
 * beyond mustAddress items (e.g. edge validation). Header shows "Not ready" (warning)
 * while Footer shows context-appropriate state. This split is intentional.
 */

interface HeaderProps {
  /** Whether analysis can run */
  isReady: boolean
  /** Whether CEE data is still loading */
  isLoading?: boolean
  /** Must address tier count */
  mustAddressCount: number
  /** Review assumptions tier count */
  reviewCount: number
  /** Optional improvements tier count */
  optionalCount: number
}

export function Header({
  isReady,
  isLoading = false,
  mustAddressCount,
  reviewCount,
  optionalCount,
}: HeaderProps) {
  // Loading state: "◌ Checking..." while CEE data loads
  if (isLoading) {
    return (
      <p className="text-sm font-semibold text-text-light">
        ◌ Checking...
      </p>
    )
  }

  // Blocked state: has mustAddress items
  if (mustAddressCount > 0) {
    return (
      <p className="text-sm font-semibold text-danger">
        ⊘ Blocked · {mustAddressCount} to address
      </p>
    )
  }

  // Not ready state: no mustAddress items but isReady is false (other gating reasons)
  if (!isReady) {
    return (
      <p className="text-sm font-semibold text-warning">
        ◌ Not ready
      </p>
    )
  }

  // Ready state: build string with non-zero counts
  // De-emphasise optional count — show "Improvements available" instead of raw number
  const parts: string[] = []
  if (reviewCount > 0) {
    parts.push(`${reviewCount} to review`)
  }
  if (optionalCount > 0) {
    parts.push('Improvements available')
  }

  const suffix = parts.length > 0 ? ` · ${parts.join(' · ')}` : ''

  return (
    <p className="text-sm font-semibold text-success">
      ✓ Ready{suffix}
    </p>
  )
}

export default Header
