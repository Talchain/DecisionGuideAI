export type ReviewNote = { id: string; decisionId: string; createdAt: number; content?: string }

const storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined

const idxKey = (decisionId: string) => `olumi:review:${decisionId}`

export function saveReviewNote(decisionId: string, content?: string): ReviewNote {
  const note: ReviewNote = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, decisionId, createdAt: Date.now(), content }
  if (!storage) return note
  const list = JSON.parse(storage.getItem(idxKey(decisionId)) || '[]') as ReviewNote[]
  const next = [note, ...list]
  storage.setItem(idxKey(decisionId), JSON.stringify(next))
  return note
}

export function listReviewNotes(decisionId: string): ReviewNote[] {
  if (!storage) return []
  try { return JSON.parse(storage.getItem(idxKey(decisionId)) || '[]') as ReviewNote[] } catch { return [] }
}
