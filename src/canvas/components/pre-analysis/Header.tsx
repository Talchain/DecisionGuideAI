/**
 * Header - Pre-Analysis Panel inline status line
 *
 * Single text line replacing the old header strip:
 * - Ready: "✓ Ready · {n} improvements" in success color
 * - Blocked: "⊘ Blocked · {n} issue(s) to fix" in danger color
 *
 * 13px, font-weight 600, no background/border/padding beyond panel's own.
 * This replaces the 'Top actions' section label.
 */

interface HeaderProps {
  /** Whether analysis can run */
  isReady: boolean
  /** Total improvements count */
  totalImprovements: number
  /** Number of blocker issues (for blocked state) */
  blockerCount?: number
}

export function Header({
  isReady,
  totalImprovements,
  blockerCount = 0,
}: HeaderProps) {
  if (isReady) {
    // Ready state: "✓ Ready · {n} optional improvements"
    return (
      <p className="text-sm font-semibold text-success">
        ✓ Ready · {totalImprovements} optional improvement{totalImprovements !== 1 ? 's' : ''}
      </p>
    )
  }

  // Blocked state: "⊘ Blocked · {n} issue(s) to fix"
  const issueText = blockerCount === 1 ? '1 issue' : `${blockerCount} issues`
  return (
    <p className="text-sm font-semibold text-danger">
      ⊘ Blocked · {issueText} to fix
    </p>
  )
}

export default Header
