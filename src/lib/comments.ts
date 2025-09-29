// src/lib/comments.ts
export type Comment = { id: string; targetId: string; label: 'Challenge' | 'Evidence'; text: string; at: string }
const KEY = 'comments.v1'
export function byTarget(targetId: string): Comment[] {
  try {
    const xs = (JSON.parse(localStorage.getItem(KEY) || '[]') as Comment[]).filter((c) => c.targetId === targetId)
    // newest-first by timestamp
    xs.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    return xs
  } catch {
    return []
  }
}
export function add(c: Comment) {
  const xs = (JSON.parse(localStorage.getItem(KEY) || '[]') as Comment[])
  // add to front for newest-first
  xs.unshift(c)
  localStorage.setItem(KEY, JSON.stringify(xs))
}
export function del(id: string) {
  const xs = (JSON.parse(localStorage.getItem(KEY) || '[]') as Comment[]).filter((c) => c.id !== id)
  localStorage.setItem(KEY, JSON.stringify(xs))
}
