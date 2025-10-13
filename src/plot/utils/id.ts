// src/plot/utils/id.ts
// Deterministic ID generation for plot nodes (n1, n2, n3, ...)

export function nextId(nodes: { id: string }[]): string {
  const nums = nodes
    .map(n => {
      const match = (n.id || '').match(/^n(\d+)$/)
      return match ? Number(match[1]) : 0
    })
    .filter(n => n > 0)
  
  const maxNum = nums.length > 0 ? Math.max(...nums) : 0
  return `n${maxNum + 1}`
}
