export type SnapshotMeta = { id: string; label: string; createdAt: number }
export type Snapshot = SnapshotMeta & { updateB64: string }
