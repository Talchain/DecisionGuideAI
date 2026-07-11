/**
 * One-time guest-draft import — login UI half (3.4).
 *
 * STUB (RED phase): inert until the lane's GREEN commit.
 */
export const DRAFT_IMPORT_MARKER_KEY = 'login.draftImport.v1'

export type DraftImportMarker = 'imported' | 'dismissed'

export function shouldOfferDraftImport(
  _user: { id: string } | null,
  _authenticated: boolean,
): boolean {
  return false
}

export function dismissDraftImport(): void {
  // inert
}

export async function importGuestDraft(_userId: string): Promise<string> {
  throw new Error('not implemented')
}
