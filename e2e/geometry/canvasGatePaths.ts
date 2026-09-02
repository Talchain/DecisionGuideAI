/**
 * One place for the paths the gate's reporter, teardown and config share, so
 * none of them can restate a constant and drift from the others.
 *
 * `GATE_OUTPUT_DIR` is the config's project `outputDir`. That is not incidental:
 * Playwright DELETES the output dir in its first setup task, before
 * `globalSetup` and before the reporter's `onBegin`, so putting the manifest
 * inside it makes a stale manifest from a previous run structurally impossible.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// This package is `"type": "module"`, so there is no `__dirname` — same
// `fileURLToPath(import.meta.url)` pattern as `e2e/visual/nodeLabelFit.visual.spec.ts`.
// Derived from THIS file's location rather than from `process.cwd()`, which
// differs between an invocation from the repo root and one from a workflow step.
export const GATE_OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../test-results/canvas-gate')

export const GATE_MANIFEST_PATH = resolve(GATE_OUTPUT_DIR, 'ran-manifest.tsv')
