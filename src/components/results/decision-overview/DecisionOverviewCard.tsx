/**
 * Wave 1 — Decision overview card (brief §4).
 * STUB (RED phase): renders nothing until the GREEN commit.
 */
export type BriefStateOverride = 'thin' | 'contradictory' | 'unverified'

export interface DecisionOverviewCardProps {
  title?: string | null
  /** Fixture-gallery-only states (plan review B3) — never set on product. */
  stateOverride?: BriefStateOverride
}

export function DecisionOverviewCard(_props: DecisionOverviewCardProps): null {
  return null
}
