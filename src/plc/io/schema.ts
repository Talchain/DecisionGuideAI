export type PlcNode = { id: string; label?: string; x?: number; y?: number }
export type PlcEdge = { from: string; to: string; label?: string }
export type PlcImportData = { nodes: PlcNode[]; edges: PlcEdge[] }
