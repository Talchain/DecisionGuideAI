// src/lib/__tests__/runSettleClassification.spec.ts
// =============================================================================
// ROADMAP 1.68 — a FAILED analysis must not be recorded as a COMPLETION.
// =============================================================================
//
// THE DEFECT — introduced by my own single-emitter amendment, not pre-existing
// -------------------------------------------------------------------------
// Making OutputsDock the sole emitter of run_completed/run_failed was right for
// four of the five failure paths (`useV2Run.ts:662, :824, :1114, :1185` all
// reach the store via `resultsError`, so OutputsDock's error-transition branch
// picks them up). The fifth does not.
//
// `useV2Run.ts:846-866` is the HTTP-200-BUT-FAILED path (`isFailedAnalysis`).
// It builds an error report and calls **`resultsComplete`** — status goes to
// 'complete' WITH a real report — so OutputsDock's complete-branch fires
// `run_completed{confidence_level:'low'}` and `run_failed` never fires at all,
// while the very same block calls `persistAnalysisFailure({code:'ANALYSIS_FAILED'})`.
// The database would record a failure and the analytics would record a success.
//
// A whole failure class silently counting as a completion is worse than the
// double-emission this amendment set out to fix: a duplicate is visible in the
// data, a misclassification is not.
//
// Corollary the same defect produced: `ERROR_CATEGORY_BY_CODE`'s
// `upstream_failed` member became unreachable — `ANALYSIS_FAILED` was the only
// code mapping to it, and it had no emitter left.
//
// WHY THE FIX IS A DISCRIMINATOR AND NOT A REROUTE
// ------------------------------------------------
// Rerouting that branch to `resultsError` would fix the telemetry and CHANGE
// THE PRODUCT: `resultsComplete` is what renders the critique list in the
// results panel, and the branch passes real `critiques`. Telemetry must not
// reshape what a user sees. So the settle is classified instead, and the
// classifier is owned by the module that CREATES the error report — not by a
// string literal copied into the consumer.
//
// Exactly one event still fires per settle, so single-emission is preserved.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createErrorReport, isErrorReport } from '../../adapters/plot/v2/responseMapper'
import { deriveErrorCategory } from '../resultsInstrumentation'

const REPO_ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

/** A minimally-real successful report — the shape OutputsDock normally settles on. */
const successReport = {
  schema: 'report.v1',
  meta: { seed: 42, response_id: 'resp-abc123', elapsed_ms: 1200 },
  model_card: { response_hash: 'abc123', response_hash_algo: 'sha256', normalized: true },
  results: { conservative: 1, likely: 2, optimistic: 3 },
  confidence: { level: 'high', why: 'tight intervals' },
  drivers: [{ label: 'x' }],
  run: { critique: [] },
} as never

describe('1.68 · an error-report settle is a FAILURE, not a completion', () => {
  it('POSITIVE CONTROL — a genuine success report is NOT classified as an error', () => {
    // Without this the predicate could return true for everything and every
    // completion would be relabelled a failure — the same defect, mirrored.
    expect(
      isErrorReport(successReport),
      'isErrorReport returned true for an ordinary successful report. Every completed run ' +
        'would be recorded as a failure.',
    ).toBe(false)
  })

  it('the report produced by createErrorReport IS classified as an error', () => {
    const report = createErrorReport('Analysis could not complete.', [], { seed: 7 })
    expect(
      isErrorReport(report),
      'the error report built by this module\'s own constructor is not recognised by this ' +
        "module's own predicate. OutputsDock would emit run_completed for a failed analysis.",
    ).toBe(true)
  })

  it('the predicate is not fooled by a report that merely has low confidence', () => {
    // 'low' confidence is a legitimate outcome of a SUCCESSFUL run. Classifying
    // on confidence would silently reclassify every genuinely-uncertain result.
    const lowButReal = {
      ...(successReport as unknown as Record<string, unknown>),
      confidence: { level: 'low', why: 'wide intervals' },
    } as never
    expect(isErrorReport(lowButReal)).toBe(false)
  })

  it('ANALYSIS_FAILED maps to upstream_failed — the category is reachable again', () => {
    expect(
      deriveErrorCategory('ANALYSIS_FAILED'),
      'the upstream_failed category has no code mapping to it — dead mapping',
    ).toBe('upstream_failed')
  })

  it('OutputsDock CONSULTS the classifier on the complete-transition', () => {
    // SOURCE-DERIVED claim, named as such: the behavioural half (rendering
    // OutputsDock and driving a store transition) is ROADMAP 2.192. This pins
    // the wiring so the classifier cannot be added and left unused — which is
    // the guarantee-theatre shape this whole change exists to remove.
    const dock = read('src/canvas/components/OutputsDock.tsx')
    expect(dock.length, 'OutputsDock.tsx looks empty — this assertion would be vacuous').toBeGreaterThan(20_000)
    expect(
      /isErrorReport\s*\(/.test(dock),
      'OutputsDock never calls isErrorReport, so the HTTP-200-but-failed path is still ' +
        'recorded as run_completed.',
    ).toBe(true)
    expect(
      /trackRunFailed\s*\(/.test(dock),
      'OutputsDock no longer emits run_failed at all',
    ).toBe(true)
  })

  it('ANTI-DRIFT — there is still exactly ONE producer of error reports', () => {
    // The consumer emits the fixed code `ANALYSIS_FAILED`, which is exact only
    // while `useV2Run.ts:846-866` is the sole `createErrorReport` call site. A
    // SECOND producer with a different failure code would make that attribution
    // a fabrication, so it must red here rather than pass silently — at which
    // point the right fix is to carry the code on the report.
    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
      const out: string[] = []
      for (const entry of readdirSync(path.join(REPO_ROOT, dir))) {
        const rel = `${dir}/${entry}`
        if (statSync(path.join(REPO_ROOT, rel)).isDirectory()) {
          if (entry === '__tests__' || entry === 'node_modules') continue
          out.push(...walk(rel))
        } else if (/\.tsx?$/.test(entry) && !/\.(spec|test)\.tsx?$/.test(entry)) {
          out.push(rel)
        }
      }
      return out
    }
    const files = walk('src')
    expect(files.length, 'the source walk collected suspiciously few files').toBeGreaterThan(300)

    const DEFINITION = 'src/adapters/plot/v2/responseMapper.ts'
    expect(
      files.includes(DEFINITION) && /export function createErrorReport/.test(read(DEFINITION)),
      'createErrorReport is no longer defined where this check expects it — the caller walk ' +
        'below would exclude the wrong file',
    ).toBe(true)

    const callers = files
      .filter((f) => f !== DEFINITION)
      .filter((f) => /\bcreateErrorReport\s*\(/.test(read(f)))
    expect(
      callers,
      'the number of createErrorReport call sites changed. OutputsDock attributes every ' +
        "error-report settle to 'ANALYSIS_FAILED', which is exact only while useV2Run's " +
        'HTTP-200-but-failed branch is the only producer. Carry the failure code on the ' +
        'report instead of adding a second producer.',
    ).toEqual(['src/canvas/hooks/useV2Run.ts'])
  })
})
