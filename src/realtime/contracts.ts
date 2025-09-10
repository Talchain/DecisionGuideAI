// Contract-only types for realtime server responses (no network in tests)
export type SnapshotIndexItem = {
  id: string
  createdAt: number // epoch ms
}

export type SnapshotIndexResponse = {
  decisionId: string
  items: SnapshotIndexItem[]
}
