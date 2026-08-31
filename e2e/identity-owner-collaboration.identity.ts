import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { submitBrief, waitForSettledDraft } from './core/lib/harness'
import {
  assertBuild, check, currentIdentity, digest, identityInput, jsonRequest,
  mountedModel, passwordLogin, scenarioRows, type IdentityInput, type Identity,
} from './helpers/identity-input'

// Existing TEST accounts only. Opt-in creates models/rounds/responses; no signup,
// credential reset, cleanup deletion, persisted sessions, or raw network artifacts.
test('identity owner create, return, isolation and attributed collaboration', async ({ playwright }, info) => {
  const names = ['environment', 'build_start', 'guest_entry', 'owner_login', 'owned_create',
    'model_content', 'reload', 'cold_return', 'other_user_isolation', 'owner_round',
    'other_user_round_denied', 'participant_response', 'owner_reveal', 'participant_owner_denied', 'build_end']
  const stages = Object.fromEntries(names.map(name => [name, 'NOT_REACHED']))
  const evidence: Record<string, unknown> = {
    stages, guest_reasoning_and_reload: 'NOT_IMPLEMENTED_IN_THIS_HARNESS',
    isolation_rung: 'WIRE', service_attribution: 'UI and same-origin CEE health pinned at start/end; not per-response telemetry',
  }
  const contexts: BrowserContext[] = []
  let browser: Browser | undefined
  let input: IdentityInput | undefined
  let failed = false
  const step = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    stages[name] = 'RUNNING'
    try {
      const result = await test.step(name, async () => {
        try { return await run() } catch (error) {
          // Sanitize INSIDE the named step: it must not retain the original error.
          const message = error instanceof Error ? error.message : ''
          evidence.failure ??= /^IDENTITY:[A-Z0-9_]+$/.test(message) ? message : `OPERATION_FAILED:${name}`
          throw new Error(`Identity acceptance stopped at ${name}; see sanitized evidence.`)
        }
      })
      stages[name] = 'PASS'
      return result
    } catch {
      stages[name] = 'FAIL'
      throw new Error(`Identity acceptance stopped at ${name}; later stages are NOT_REACHED.`)
    }
  }
  const freshPage = async () => {
    browser ??= await playwright.chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(45_000)
    contexts.push(context)
    return context.newPage()
  }
  try {
    input = await step('environment', async () => identityInput())
    const cfg = input
    evidence.expected_ui_commit = cfg.commit
    evidence.expected_cee_commit = cfg.ceeCommit
    evidence.target_kind = /^[a-f0-9]{24}--/.test(new URL(cfg.ui).hostname) ? 'immutable' : 'mutable_alias_sampled'
    await step('build_start', async () => { evidence.build_start = await assertBuild(cfg) })
    await step('guest_entry', async () => {
      const guest = await freshPage()
      await guest.goto(`${cfg.ui}/#/canvas`)
      await expect(guest.getByTestId('first-use-input-bar-textarea')).toBeVisible()
      await expect(guest.getByTestId('owner-password-form')).toHaveCount(0)
      await guest.context().close()
    })
    const owner = await freshPage()
    const a = await step('owner_login', () => passwordLogin(owner, cfg, cfg.a))
    const scenarioId = await step('owned_create', async () => {
      await owner.getByRole('button', { name: /^(Start a new decision|New decision)$/ }).click()
      await expect(owner).toHaveURL(/#\/scenario\/[a-f0-9-]{36}$/i)
      const id = owner.url().split('/scenario/')[1]
      const row = await scenarioRows(cfg, a, id)
      check(row.status === 200 && row.body?.length === 1 && row.body[0].id === id && row.body[0].user_id === a.id, 'CREATED_ROW_OWNER_MISMATCH')
      evidence.created_scenario_id = id
      await owner.reload()
      check((await currentIdentity(owner, cfg)).id === a.id, 'CREATE_RELOAD_IDENTITY_MISMATCH')
      return id
    })
    let graph: { nodes: Array<{ id: string; kind?: string; type?: string; label?: string; data?: { label?: string } }> }
    const baseline = await step('model_content', async () => {
      await submitBrief(owner, 'Synthetic acceptance model: a UK software team is considering enterprise expansion or improving its existing small-business service. Revenue is flat, customer churn is rising, and enterprise demand is uncertain. Help us model the goal, alternatives and assumptions.')
      evidence.content_mode = 'new_model'
      evidence.content_scenario_id = scenarioId
      await waitForSettledDraft(owner, { timeoutMs: 300_000 })
      let row: Awaited<ReturnType<typeof scenarioRows>>
      await expect.poll(async () => {
        row = await scenarioRows(cfg, a, scenarioId)
        return row.status === 200 && row.body?.length === 1 && row.body[0]?.id === scenarioId && row.body[0]?.user_id === a.id && row.body[0]?.graph?.nodes?.length > 0
      }, { timeout: 120_000, intervals: [2_000] }).toBe(true)
      graph = row!.body[0].graph
      const mounted = await mountedModel(owner)
      check(mounted.length > 0 && mounted.every(node => node.label.length > 0), 'NONEMPTY_MOUNTED_CONTENT_REQUIRED')
      check(mounted.every(node => graph.nodes.some(saved => saved.id === node.id)), 'MOUNTED_IDS_NOT_IN_OWNED_ROW')
      evidence.node_count = mounted.length
      evidence.graph_digest = digest(graph)
      return mounted
    })
    const verifyReturn = async (page: Page, identity: Identity) => {
      await expect.poll(async () => digest(await mountedModel(page)), { timeout: 90_000 }).toBe(digest(baseline))
      check((await currentIdentity(page, cfg)).id === a.id && identity.id === a.id, 'RETURN_IDENTITY_MISMATCH')
      const row = await scenarioRows(cfg, identity, scenarioId)
      check(row.status === 200 && row.body?.length === 1 && row.body[0]?.id === scenarioId && row.body[0]?.user_id === a.id && digest(row.body[0].graph) === digest(graph), 'RETURN_GRAPH_OR_OWNER_CHANGED')
    }
    await step('reload', async () => { await owner.reload(); await verifyReturn(owner, a) })
    await step('cold_return', async () => {
      const cold = await freshPage()
      const returned = await passwordLogin(cold, cfg, cfg.a)
      await cold.goto(`${cfg.ui}/#/scenario/${scenarioId}`)
      await verifyReturn(cold, returned)
    })
    const other = await freshPage()
    const b = await step('other_user_isolation', async () => {
      const identity = await passwordLogin(other, cfg, cfg.b)
      check(identity.id !== a.id, 'DISTINCT_VERIFIED_USERS_REQUIRED')
      const row = await scenarioRows(cfg, identity, scenarioId)
      check(row.status === 200 && Array.isArray(row.body) && row.body.length === 0, 'OTHER_USER_READ_PRIVATE_ROW')
      const endpoint = `${cfg.ui}/bff/cee/scenarios/${scenarioId}/graph`
      const query = (who: Identity) => jsonRequest(endpoint, { method: 'POST', headers: {
        Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ user_id: a.id }) })
      const legitimate = await query(a)
      check(legitimate.status === 200 && legitimate.body?.graph_present === true, 'OWNER_GRAPH_CONTROL_NOT_ACCEPTED')
      const denied = await query(identity)
      check([403, 404].includes(denied.status), 'BODY_USER_ID_OVERRIDES_VERIFIED_USER')
      evidence.isolation_http = denied.status
      return identity
    })
    let minted: { round_id: string; participants: Array<{ participant_id: string; display_name: string; token: string }> }
    let mintBody: unknown
    const target = await step('owner_round', async () => {
      const factor = graph.nodes.find(node => node.kind === 'factor' || node.type === 'factor')
      check(factor?.id, 'NO_SAVED_FACTOR_TARGET')
      await owner.getByRole('link', { name: 'Ask your team', exact: true }).click()
      await owner.getByTestId('panel-target-id').fill(factor.id)
      await owner.getByTestId('panel-target-label').fill(factor.label ?? factor.data?.label ?? factor.id)
      await owner.getByTestId('panel-name-a').fill('Identity Participant')
      await owner.getByTestId('panel-name-b').fill('')
      const response = owner.waitForResponse(r => r.url() === `${cfg.ui}/bff/collab/rounds` && r.request().method() === 'POST')
      await owner.getByTestId('panel-mint').click()
      const result = await response
      mintBody = result.request().postDataJSON()
      const payload = mintBody as { scenario_id?: string; targets?: Array<{ target?: { kind?: string; id?: string } }>; participants?: unknown[] }
      check(payload.scenario_id === scenarioId && payload.targets?.length === 1 && payload.targets[0].target?.kind === 'factor' && payload.targets[0].target?.id === factor.id && payload.participants?.length === 1, 'MINT_REQUEST_NOT_BOUND_TO_OWNED_TARGET')
      minted = await result.json()
      check(result.ok() && typeof minted?.round_id === 'string' && minted.participants?.length === 1 && minted.participants[0].token, 'OWNER_ROUND_NOT_CREATED')
      await expect(owner.getByTestId('panel-token-warning')).toBeVisible()
      evidence.round_id = minted.round_id
      return factor
    })
    await step('other_user_round_denied', async () => {
      const denied = await jsonRequest(`${cfg.ui}/bff/collab/rounds`, { method: 'POST', headers: {
        Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json',
      }, body: JSON.stringify(mintBody) })
      check(denied.status === 403 && denied.body?.code === 'collab_owner_only', 'OTHER_USER_VALID_ROUND_NOT_DENIED')
      evidence.collab_denial_http = denied.status
    })
    const words = 'About a 70 percent chance, based on our synthetic customer interviews.'
    await step('participant_response', async () => {
      const participant = minted.participants[0]
      const link = await owner.getByLabel(`Panel link for ${participant.display_name}`, { exact: true }).inputValue()
      const invite = new URL(link)
      check(invite.origin === cfg.ui && invite.hash === `#/panel/${minted.round_id}` &&
        invite.searchParams.get('ct') === participant.token, 'INVITE_NOT_BOUND_TO_MINTED_PARTICIPANT')
      const page = await freshPage()
      await page.goto(link)
      await expect(page.getByTestId(`packet-target-${target.id}`)).toBeVisible()
      await expect(page.getByTestId('owner-password-form')).toHaveCount(0)
      const belief = page.getByTestId(`packet-belief-${target.id}`)
      await belief.getByRole('textbox').fill(words)
      await belief.getByRole('button', { name: /^Use .* for / }).click({ timeout: 90_000 })
      await expect(page.getByTestId(`packet-confirmation-${target.id}`)).toContainText('Your answer is in.')
      await expect(page.getByTestId(`packet-confirmation-recorded-${target.id}`)).toContainText(`as ${participant.display_name}`)
    })
    await step('owner_reveal', async () => {
      const revealed = owner.waitForResponse(r => r.url() === `${cfg.ui}/bff/collab/rounds/${minted.round_id}/reveal`)
      await owner.getByTestId('panel-close').click()
      const received = await revealed
      check(received.ok() && (await received.json()).round_id === minted.round_id, 'REVEAL_ROUND_MISMATCH')
      const response = owner.getByTestId(`reveal-target-${target.id}`).getByTestId(`reveal-response-${minted.participants[0].participant_id}`)
      await expect(response).toContainText('Identity Participant')
      await expect(response).toContainText(words)
    })
    await step('participant_owner_denied', async () => {
      const endpoint = `${cfg.ui}/bff/collab/rounds/${minted.round_id}/reveal`
      const query = (token: string) => jsonRequest(endpoint, { headers: { Authorization: `Bearer ${token}` } })
      const accepted = await query(a.token)
      check(accepted.status === 200 && accepted.body?.round_id === minted.round_id, 'OWNER_REVEAL_CONTROL_FAILED')
      const denied = await query(minted.participants[0].token)
      check(denied.status === 401 && !Array.isArray(denied.body?.per_target), 'PARTICIPANT_TOKEN_ACCEPTED_AS_OWNER')
      evidence.participant_owner_denial_http = denied.status
    })
  } catch { failed = true } finally {
    if (input) {
      try { await step('build_end', async () => { evidence.build_end = await assertBuild(input!) }) } catch { failed = true }
    }
    await Promise.all(contexts.map(context => context.close().catch(() => {})))
    await browser?.close()
    evidence.implemented_checks = failed ? 'INCOMPLETE' : 'PASS'
    // The full mission also needs fresh-guest reasoning/return and auth-failure
    // witnesses. Never turn this narrower owner/Collaboration run into closure.
    evidence.auth_failure_witness = 'NOT_IMPLEMENTED_IN_THIS_HARNESS'
    evidence.mission_verdict = 'INCOMPLETE'
    const path = info.outputPath('identity-acceptance-sanitized.json')
    await writeFile(path, JSON.stringify(evidence, null, 2))
    await info.attach('identity-acceptance-sanitized.json', { path, contentType: 'application/json' })
  }
  check(!failed, 'JOURNEY_INCOMPLETE_SEE_SANITIZED_EVIDENCE')
})
