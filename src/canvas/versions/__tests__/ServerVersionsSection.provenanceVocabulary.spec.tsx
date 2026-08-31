/**
 * The shared-version provenance badge speaks ENGLISH, not the wire.
 *
 * ── THE DEFECT THIS PINS ────────────────────────────────────────────────────
 * `provenanceLabel` switched on the RETIRED v1 vocabulary
 * (`user_save | commit | pre_restore | restore`) while the adapter maps v2, and
 * its `default` arm returned the token VERBATIM. So a real user read
 * `committed_mutation`, `initial` and `unknown` on screen — raw wire tokens in
 * a product surface. Exactly one v1 arm still worked, and only by coincidence:
 * `restore` is spelled identically in both vocabularies.
 *
 * ── WHERE THE EXPECTATIONS COME FROM (trap 13c) ─────────────────────────────
 * A mutant kit validates SENSITIVITY, never CORRECTNESS — a full kill-rate
 * against a self-authored oracle is a perfect score on the wrong exam. So every
 * expected string below is derived from the PRODUCER's declared semantics at
 * CEE staging `d0544243`, not from this author's reading of what a token ought
 * to mean. The derivation, per token:
 *
 *   initial            `append_turn_atomic_v5`, migration
 *                      20260824200000_c8_atomic_model_version_restore.sql:820-828 —
 *                      `CASE WHEN NOT v_has_versions THEN 'initial'`. Written
 *                      only when the scenario has no versions yet.
 *
 *   committed_mutation the `ELSE` of that same CASE, inserted at :832-847 with
 *                      `label='Committed model change'`, `provenance='commit'`
 *                      and a `source_turn_id`; `store-adapter.ts:335` reads this
 *                      kind keyed by (source_turn_id, mutation_id). It is the
 *                      version a committed TURN leaves behind — automatic.
 *
 *   restore            `restore_model_version_atomic_v1`, same migration
 *                      :416-431 — `creation_kind='restore'` with
 *                      `source_version_id=p_version_id`. The graph was COPIED
 *                      from an earlier version.
 *
 *   variant_creation   NO PRODUCER. Both variant kinds appear 6 times each in
 *   variant_promotion  CEE and every occurrence is a DECLARATION site (DB CHECK
 *                      :123-128, validator `store-adapter.ts:485-486`, wire
 *                      schema `history-v2.ts:26,29`, TS union `types.ts:53-54`,
 *                      contracts enum `contracts.ts:133-134`, and summaryV2's
 *                      pass-through `case`). Zero writes, zero RPC parameters.
 *                      Contrast control in the same sweep: the fabricated token
 *                      `variant_rebase` read 0 while both real tokens read 6 —
 *                      so the sweep was not simply blind.
 *                      ⚠ THEREFORE THEIR COPY IS CONTRACT-DERIVED, NOT
 *                      PRODUCER-DERIVED. The only thing CEE guarantees about
 *                      them is structural: both arms REQUIRE a non-null
 *                      `source_version_id`, so the version was made from an
 *                      earlier one. That — and nothing more — is what they say.
 *                      Inventing "variant of…" / "promoted from…" would be
 *                      naming a product feature that does not exist.
 *
 *   unknown            THREE genuinely different situations collapse into this
 *                      one token, and the copy has to be true of ALL THREE:
 *                        (a) the pre-restore safety snapshot, written
 *                            EXPLICITLY as `unknown` at :404-409;
 *                        (b) ⭐ EVERY DELIBERATE USER SAVE. The save RPC
 *                            `create_model_version` lives in migration
 *                            20260705120000_v5_model_versions.sql and contains
 *                            ZERO occurrences of `creation_kind` (measured);
 *                            `store-adapter.ts:193-207` passes `p_provenance`
 *                            and no creation kind. So a save persists NULL, and
 *                            `summaryV2`'s `case null` with no
 *                            `restored_from_version_id` resolves to `unknown`;
 *                        (c) genuine legacy rows — the DB column's own comment
 *                            (:165-166) reads "NULL is legacy unknown".
 *                      A label like "you saved this" would be FALSE for (a) and
 *                      (c). "origin not recorded" is true of all three, and it
 *                      is the honest report of a real server-side gap.
 *
 * ── THE EXPECTATIONS ARE HAND-WRITTEN HERE, DELIBERATELY ────────────────────
 * The table below is a CORPUS, not a derivation from the implementation. A
 * guard derived from the thing it guards proves agreement and can never prove
 * the mapping is RIGHT (trap 12d). If someone edits the copy, these RED.
 *
 * ⚠ SCOPE (trap 3): jsdom proves presence and text — never that a user SEES the
 * badge on a deployed canvas. The deployed witness is separate and is not
 * claimed here.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const SOURCE_ID = 'dddddddd-4444-4444-8444-dddddddddddd'
const HASH = 'a'.repeat(64)

const listModelVersions = vi.fn()
const saveModelVersion = vi.fn()
const restoreModelVersion = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', () => ({
  listModelVersions: (...args: unknown[]) => listModelVersions(...args),
  saveModelVersion: (...args: unknown[]) => saveModelVersion(...args),
  restoreModelVersion: (...args: unknown[]) => restoreModelVersion(...args),
}))

vi.mock('../../utils/mergeAppliedGraph', () => ({
  reconcileAppliedGraph: vi.fn(),
}))

const authState: { user: { id: string } | null } = { user: { id: USER } }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}))

const sessionState: { userId: string | null; accessToken: string | null } = {
  userId: USER,
  accessToken: 'token-for-USER',
}
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: () => Promise.resolve({ ...sessionState }),
}))

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ServerVersionsSection,
  provenanceLabel,
  SERVER_VERSION_CREATION_KINDS,
} from '../ServerVersionsSection'
import { useCanvasStore } from '../../store'

/**
 * THE CORPUS. Exact token → exact rendered string, bound by IDENTITY (trap 19):
 * never a predicate another token could satisfy.
 */
const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  ['initial', 'first version'],
  ['committed_mutation', 'auto — saved on a model change'],
  ['restore', 'restored from an earlier version'],
  ['variant_creation', 'made from an earlier version'],
  ['variant_promotion', 'made from an earlier version'],
  ['unknown', 'origin not recorded'],
]

/** Retired v1 spellings. Unreachable today — see the reachability test below. */
const RETIRED_V1_ONLY = ['user_save', 'commit', 'pre_restore'] as const

function serverVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_ID,
    versionNumber: 1,
    label: 'First cut',
    provenance: 'unknown',
    restoredFromVersionId: null,
    createdAt: '2026-08-17T10:00:00.000Z',
    graphIdentityHash: HASH,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { id: USER }
  sessionState.userId = USER
  sessionState.accessToken = 'token-for-USER'
  useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ currentScenarioId: null } as never)
})

describe('provenance vocabulary — the v2 union, in the product’s own words', () => {
  it.each(EXPECTED)(
    'creation.kind %s renders exactly "%s"',
    (kind, copy) => {
      expect(provenanceLabel(kind)).toBe(copy)
    },
  )

  it('covers the CEE union EXACTLY — no member unmapped, no member invented', () => {
    // Hand-written from CEE `history-v2.ts:19-32` at staging d0544243. If CEE
    // adds a seventh kind this list is short, and that is a limit this suite
    // cannot see (the UI has no importable copy of the union — schemas 0.48.0
    // does not carry it). Stated rather than papered over.
    const unionFromCee = [
      'committed_mutation',
      'initial',
      'restore',
      'unknown',
      'variant_creation',
      'variant_promotion',
    ]
    expect([...SERVER_VERSION_CREATION_KINDS].sort()).toEqual(unionFromCee)
    expect([...new Set(EXPECTED.map(([k]) => k))].sort()).toEqual(unionFromCee)
  })

  it('NEVER returns a token verbatim — the defect, pinned directly', () => {
    for (const kind of SERVER_VERSION_CREATION_KINDS) {
      expect(provenanceLabel(kind)).not.toBe(kind)
    }
    // The wire tell: snake_case never reaches a user.
    for (const [, copy] of EXPECTED) {
      expect(copy).not.toMatch(/_/)
    }
  })

  it('an UNRECOGNISED token renders NO badge — not the token, not a guess', () => {
    // Decision, defended: rendering the raw token is the defect; inventing copy
    // for a value we by definition do not understand is worse; and reusing the
    // `unknown` copy would answer a DIFFERENT question (trap 21) — "the server
    // did not record it" vs "we have no words for it". The server DID record
    // something here, so "origin not recorded" would misreport a UI gap as a
    // server gap. Silence is the only thing that is true.
    for (const token of ['heat_death', 'MERGE', 'committed_mutation_v3', '  ']) {
      expect(provenanceLabel(token)).toBeNull()
    }
    expect(provenanceLabel('heat_death')).not.toBe(
      provenanceLabel('unknown'),
    )
  })

  it('a null provenance renders no badge', () => {
    expect(provenanceLabel(null)).toBeNull()
  })

  it('the RETIRED v1 tokens never leak as themselves', () => {
    // They cannot arrive (see the reachability note), but if one ever did it
    // must not print. `restore` is deliberately NOT in this list: it is spelled
    // identically in both vocabularies and IS reachable — which is the contrast
    // control proving this assertion is not vacuous.
    for (const token of RETIRED_V1_ONLY) {
      expect(provenanceLabel(token)).toBeNull()
    }
    expect(provenanceLabel('restore')).toBe('restored from an earlier version')
  })
})

describe('provenance vocabulary — on the rendered surface', () => {
  it.each(EXPECTED)(
    'a %s version shows "%s" and the raw token appears nowhere',
    async (kind, copy) => {
      listModelVersions.mockResolvedValue({
        status: 'list',
        versions: [
          serverVersion({
            provenance: kind,
            restoredFromVersionId: kind.startsWith('variant') || kind === 'restore' ? SOURCE_ID : null,
          }),
        ],
        currentVersionId: null,
        requestId: 'req-1',
      })

      render(<ServerVersionsSection />)
      await waitFor(() => {
        expect(screen.getAllByTestId('server-version-row')).toHaveLength(1)
      })

      // ⚠ BOUND TO THE BADGE BY IDENTITY, WITH EXACT EQUALITY — and the first
      // draft of this assertion got it wrong in the instructive direction. It
      // swept the whole container for the token as a SUBSTRING, which REDs on
      // `restore` for three innocent reasons: the section's own prose says
      // "see and restore them", the correct copy CONTAINS the token
      // ("**restore**d from an earlier version"), and every row carries a
      // "Restore" button. A value predicate that other legitimate text
      // satisfies is trap 19 pointed at an absence claim — it manufactures a
      // FALSE RED and would have destroyed a correct fix. Exact equality on
      // the identified badge is the claim actually worth making.
      const badge = screen.getByTestId('server-version-origin')
      expect(badge.textContent).toBe(copy)
      expect(badge.textContent).not.toBe(kind)
    },
  )

  it('an unrecognised token puts NOTHING on screen where the badge would be', async () => {
    listModelVersions.mockResolvedValue({
      status: 'list',
      versions: [serverVersion({ provenance: 'heat_death' })],
      currentVersionId: null,
      requestId: 'req-1',
    })

    const { container } = render(<ServerVersionsSection />)
    await waitFor(() => {
      expect(screen.getAllByTestId('server-version-row')).toHaveLength(1)
    })
    // No badge element AT ALL — the absence is the assertion, bound by testid.
    expect(screen.queryByTestId('server-version-origin')).toBeNull()
    expect(container.textContent ?? '').not.toContain('heat_death')
    expect(container.textContent ?? '').not.toContain('origin not recorded')
    // The row still renders its real facts — this is not a blank-screen pass,
    // and the badge's absence is not the whole section failing to render.
    expect(screen.getAllByTestId('server-version-row')[0]!).toHaveTextContent('First cut')
  })

  it('POSITIVE CONTROL — the badge testid IS present on a recognised kind', () => {
    // Without this, every `queryByTestId(...)).toBeNull()` above would pass
    // just as happily against a typo in the testid (trap 13: an absence
    // assertion needs a demonstrated presence).
    listModelVersions.mockResolvedValue({
      status: 'list',
      versions: [serverVersion({ provenance: 'initial' })],
      currentVersionId: null,
      requestId: 'req-1',
    })
    render(<ServerVersionsSection />)
    return waitFor(() => {
      expect(screen.getByTestId('server-version-origin').textContent).toBe('first version')
    })
  })
})

/**
 * ⭐ THE MOUNT-PATH BINDING (CLAUDE.md trap 3b).
 *
 * This estate has shipped the SAME badge dark TWICE by pointing a full green
 * suite — render tests, mutants and all — at a component the deployed flags do
 * not mount. Every instrument agreed with every other, and none of them touched
 * what a user loads. So the copy tests above are worth nothing on their own
 * unless the chain that renders them is pinned too.
 *
 * Derived at UI `735c0ff1`, and it is genuinely UNGATED by any feature flag:
 *   CanvasMVP.tsx:329        <VersionsPanelHost />      — unconditional
 *   VersionsPanelHost.tsx:28 <WhatChangedPanel …/>      — runtime `isOpen` only
 *   WhatChangedPanel.tsx:325 <ServerVersionsSection />  — unconditional
 * The only gate upstream is `AuthGuard`, which passes for everyone under the
 * deployed guest posture (`netlify.toml:29` pins `VITE_AUTH_MODE = "guest"`).
 *
 * This reads SOURCE rather than rendering the route, following the pattern this
 * repo already uses (`starterStripMountPath.spec.ts`): rendering `CanvasMVP`
 * would drag in the whole canvas and prove less. It fails loud if anyone wraps
 * a hop in a flag — which is the single change that would silently re-dark this
 * badge.
 *
 * ⚠ WHAT THIS DOES NOT CLAIM. It does not claim a real user sees the badge.
 * The component gates ITSELF on `isRestoreCapableIdentity`, and
 * `sanitiseUserId('guest')` is null — so the DEFAULT deployed reader (a guest)
 * gets the sign-in invitation and no list at all. The badge is reachable only
 * for a SIGNED-IN user on a UUID scenario with at least one server version.
 * That is a sign-in gate, not a dark launch, and jsdom cannot witness either.
 */
describe('the badge’s mount path is unflagged — pinned at the source (trap 3b)', () => {
  const root = resolve(__dirname, '../../..')
  const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

  it('CanvasMVP mounts VersionsPanelHost with no flag guard', () => {
    const src = read('routes/CanvasMVP.tsx')
    expect(src).toContain('<VersionsPanelHost />')
    // Positive control: the file we read is the one we think it is.
    expect(src).toContain('CanvasMVP')
  })

  it('WhatChangedPanel mounts ServerVersionsSection with no flag guard', () => {
    const src = read('canvas/versions/WhatChangedPanel.tsx')
    expect(src).toContain('<ServerVersionsSection />')
    expect(src).toContain('WhatChangedPanel')
  })

  it('no hop wraps the chain in a feature flag', () => {
    // If a flag ever gates a hop, the token appears in that file and this REDs,
    // forcing whoever adds it to state the deployed posture here.
    for (const [file, mount] of [
      ['routes/CanvasMVP.tsx', '<VersionsPanelHost />'],
      ['canvas/versions/WhatChangedPanel.tsx', '<ServerVersionsSection />'],
    ] as const) {
      const src = read(file)
      const line = src.split('\n').find((l) => l.includes(mount))
      expect(line, `${file} no longer mounts ${mount}`).toBeDefined()
      // The mount line itself carries no inline conditional.
      expect(line).not.toMatch(/&&|\?\s|isEnabled|useFlag|FEATURE_/)
    }
  })
})
