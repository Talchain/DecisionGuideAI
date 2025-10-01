// src/lib/scorecard.ts
export type KR = { target: number; actual: number }
export type GradeBreakdown = { score: number; grade: 'A'|'B'|'C'|'D'|'F'; details: string }

// Simple grading from 0..100 to letter with thresholds
export function toLetter(score: number): 'A'|'B'|'C'|'D'|'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

// Compute a score from KRs: fraction of targets met weighted equally
export function gradeFromKRs(krs: KR[]): GradeBreakdown {
  if (!Array.isArray(krs) || krs.length === 0) return { score: 0, grade: 'F', details: 'No KRs' }
  let met = 0
  for (const k of krs) {
    if (typeof k.target === 'number' && typeof k.actual === 'number' && k.actual >= k.target) met += 1
  }
  const score = Math.round((met / krs.length) * 100)
  const grade = toLetter(score)
  const details = `${met}/${krs.length} KRs met`
  return { score, grade, details }
}
