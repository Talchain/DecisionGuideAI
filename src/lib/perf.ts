export function mark(name: string) {
  try { performance.mark(name) } catch {}
}

export function measure(name: string, start?: string, end?: string) {
  try { performance.measure(name, start as any, end as any) } catch {}
}
