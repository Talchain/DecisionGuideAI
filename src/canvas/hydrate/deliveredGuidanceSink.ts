/**
 * SD-1 Slice R (CEE #2654) — the ONE seam between the read leg and the guidance store for a Run's DELIVERED record.
 *
 * ⚠ A LEAF, deliberately: types only. The read leg's store view (`provisionalApplyStore.ts`) must stay a leaf (#2308:
 * importing a hook chain into the hydrate leg turned staging red), and the guidance store's import chain is not one. So
 * the guidance store REGISTERS its adopter here at module load, and the read leg hands the record over without
 * importing it. Unregistered (the guidance store never loaded) = nothing is adopted; never an error.
 */
import type { RunDeliveredRecord } from '@talchain/schemas/boundary'

export interface DeliveredRecordAdoption {
  readonly runId: string
  readonly scenarioId: string | null
  readonly record: RunDeliveredRecord
}

type Adopter = (adoption: DeliveredRecordAdoption) => void

let adopter: Adopter | null = null

/** The guidance store registers its adopter; the returned function unregisters exactly that one. */
export function registerDeliveredRecordAdopter(next: Adopter): () => void {
  adopter = next
  return () => {
    if (adopter === next) adopter = null
  }
}

/** Hand a bound delivered record to whoever adopts it. */
export function adoptDeliveredRecord(adoption: DeliveredRecordAdoption): void {
  adopter?.(adoption)
}
