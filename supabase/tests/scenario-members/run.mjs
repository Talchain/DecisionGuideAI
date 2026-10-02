// Dry run of the viewer-share migration on PGlite, with the LIVE scenarios RLS and the LIVE write-door bodies.
// Never touches Supabase. Usage: node run.mjs <migration.sql>. Every row binds to exact ids, SQLSTATE + message, or
// row tuples. Exits 1 if any row fails or no migration is given.
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'

const migration = process.argv[2]
if (!migration) { console.error('no migration given'); process.exit(2) }
const db = new PGlite()
await db.exec(fs.readFileSync(new URL('setup.sql', import.meta.url), 'utf8'))
await db.exec(fs.readFileSync(new URL('live-write-doors.sql', import.meta.url), 'utf8'))
await db.exec(fs.readFileSync(migration, 'utf8'))

const U = n => `00000000-0000-0000-0000-0000000000${n}`
const OWNER = U('0a'), MEMBER = U('0b'), STRANGER = U('0c'), UNCONFIRMED = U('0d'), OTHER_OWNER = U('0e')
const DEC = U('a1'), OTHERS_DEC = U('a2'), GUEST = U('a3')
await db.exec(`
insert into auth.users values
 ('${OWNER}','owner@olumi.test',now()), ('${MEMBER}','Colleague@Olumi.test',now()), ('${STRANGER}','stranger@olumi.test',now()),
 ('${UNCONFIRMED}','unconfirmed@olumi.test',null), ('${OTHER_OWNER}','other@olumi.test',now());
insert into public.user_profiles values ('${OWNER}','owner@olumi.test','Ada Owner'), ('${OTHER_OWNER}','other@olumi.test',null);
insert into public.scenarios(id,user_id,title,graph,brief_text,graph_identity_hash) values
 ('${DEC}','${OWNER}','Hire a second engineer?','{"nodes":[{"id":"g"}],"edges":[]}','Should we hire?','h1'),
 ('${OTHERS_DEC}','${OTHER_OWNER}','Someone else''s decision','{"nodes":[{"id":"x"}],"edges":[]}',null,null),
 ('${GUEST}',null,'Guest draft','{"nodes":[{"id":"q"}],"edges":[]}',null,null);
`)

async function as(role, uid, sql) {
  const claims = JSON.stringify(uid ? { sub: uid, role } : { role })
  try {
    await db.exec(`set role ${role}`)
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
    const r = await db.query(sql)
    return { ok: true, rows: r.rows, affected: r.affectedRows }
  } catch (e) {
    return { ok: false, code: e.code, err: e.message }
  } finally {
    await db.exec('reset role')
  }
}
const q = async sql => (await db.query(sql)).rows
const canon = v => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
const decRow = async () => (await q(`select row_to_json(s)::text t from public.scenarios s where id='${DEC}'`))[0].t
const members = async () => (await q(`select scenario_id, email, role, invited_by, (revoked_at is not null) revoked from public.scenario_members order by created_at, email`))
const results = []
const row = (id, name, pass, detail) => { results.push(!!pass); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${pass ? '' : ' :: ' + JSON.stringify(detail).slice(0, 600)}`) }
const share = (uid, sid, email) => as('authenticated', uid, `select public.share_scenario('${sid}', '${email}') r`)

// ── SHARE ────────────────────────────────────────────────────────────────────────────────────────────────────────
const s1 = await share(OWNER, DEC, '  colleague@OLUMI.test ')
row('S1', 'the owner shares: {shared:true}, one active row, email normalised, invited_by = owner', s1.ok && canon(s1.rows[0].r) === canon({ shared: true })
  && canon(await members()) === canon([{ scenario_id: DEC, email: 'colleague@olumi.test', role: 'viewer', invited_by: OWNER, revoked: false }]), { s1, m: await members() })
const s2 = await share(OWNER, DEC, 'Colleague@olumi.test')
row('S2', 'sharing again is idempotent (one active row)', s2.ok && (await members()).length === 1, { s2 })
const before3 = canon(await members())
const s3 = await share(STRANGER, DEC, 'stranger@olumi.test')
row('S3', 'a NON-OWNER cannot share (SM403), nothing written', !s3.ok && s3.code === 'SM403' && s3.err === 'share_scenario: scenario not found or not owned by caller' && canon(await members()) === before3, s3)
const s3b = await share(OWNER, OTHERS_DEC, 'colleague@olumi.test')
row('S3b', 'an owner cannot share SOMEONE ELSE\'S decision (same SM403 bytes)', !s3b.ok && s3b.code === 'SM403' && s3b.err === s3.err, s3b)
const s3c = await share(OWNER, GUEST, 'colleague@olumi.test')
row('S3c', 'a GUEST decision cannot be shared (no owner)', !s3c.ok && s3c.code === 'SM403', s3c)
const s4 = await as('anon', null, `select public.share_scenario('${DEC}', 'x@olumi.test')`)
row('S4', 'anon cannot call share_scenario', !s4.ok && s4.err === 'permission denied for function share_scenario', s4)
const s5a = await share(OWNER, DEC, 'not-an-email'), s5b = await share(OWNER, DEC, 'OWNER@olumi.test')
row('S5', 'a malformed address and the owner\'s own address are refused (SM400)', !s5a.ok && s5a.code === 'SM400' && !s5b.ok && s5b.code === 'SM400' && s5b.err === 'share_scenario: that is your own address', { s5a, s5b })
const s6 = await share(OWNER, DEC, 'no-account-yet@olumi.test')
row('S6', 'NO ACCOUNT ORACLE: an address with no account answers the same {shared:true}', s6.ok && canon(s6.rows[0].r) === canon(s1.rows[0].r), s6)

// ── WHAT A MEMBER SEES ───────────────────────────────────────────────────────────────────────────────────────────
const m1 = await as('authenticated', MEMBER, `select * from public.list_shared_scenarios()`)
row('M1', 'the member sees it under "Shared with me" (title, owner name)', m1.ok && m1.rows.length === 1 && m1.rows[0].scenario_id === DEC && m1.rows[0].title === 'Hire a second engineer?' && m1.rows[0].owner_name === 'Ada Owner', m1)
const acc = async (role, uid) => (await as(role, uid, `select public.scenario_access('${DEC}') a`))
const [aO, aM, aS, aU] = [await acc('authenticated', OWNER), await acc('authenticated', MEMBER), await acc('authenticated', STRANGER), await acc('authenticated', UNCONFIRMED)]
const aA = await as('anon', null, `select public.scenario_access('${DEC}') a`)
row('M2', 'scenario_access: owner / viewer / none (stranger) / none (unconfirmed); anon cannot call it', aO.rows?.[0].a === 'owner' && aM.rows?.[0].a === 'viewer' && aS.rows?.[0].a === 'none' && aU.rows?.[0].a === 'none' && !aA.ok, { aO, aM, aS, aU, aA })
const isM = async (uid) => (await as('service_role', null, `select public.is_scenario_member('${DEC}', '${uid}') m`)).rows?.[0].m
row('M3', 'is_scenario_member (CEE, service_role): member true, stranger false, owner false (owner is not a member)', (await isM(MEMBER)) === true && (await isM(STRANGER)) === false && (await isM(OWNER)) === false, {})
const m3b = await as('authenticated', MEMBER, `select public.is_scenario_member('${DEC}', '${MEMBER}')`)
row('M3b', 'authenticated cannot call is_scenario_member (CEE-only)', !m3b.ok && m3b.err === 'permission denied for function is_scenario_member', m3b)
await share(OWNER, DEC, 'unconfirmed@olumi.test')
const m4 = await as('authenticated', UNCONFIRMED, `select * from public.list_shared_scenarios()`)
row('M4', 'an UNCONFIRMED email that matches a share sees nothing', m4.ok && m4.rows.length === 0 && (await isM(UNCONFIRMED)) === false, m4)
const m5 = await as('authenticated', STRANGER, `select * from public.list_shared_scenarios()`)
row('M5', 'a non-member sees nothing shared', m5.ok && m5.rows.length === 0, m5)
const m6 = await as('authenticated', MEMBER, `select * from public.scenario_members`)
const m6b = await as('authenticated', MEMBER, `insert into public.scenario_members(scenario_id,email,invited_by) values ('${OTHERS_DEC}','colleague@olumi.test','${MEMBER}')`)
row('M6', 'the members table is closed to direct reads AND writes', !m6.ok && m6.err === 'permission denied for table scenario_members' && !m6b.ok && m6b.err === 'permission denied for table scenario_members', { m6, m6b })

// M7 defence in depth: memberships the share door can never create (on a GUEST decision; on the member's OWN decision),
// inserted directly as an operator could, must never surface as access.
const OWN = U('a4')
await db.exec(`insert into public.scenarios(id,user_id,title,graph) values ('${OWN}','${MEMBER}','Member''s own','{"nodes":[],"edges":[]}');
  insert into public.scenario_members(scenario_id,email,invited_by) values ('${GUEST}','colleague@olumi.test','${OWNER}'), ('${OWN}','colleague@olumi.test','${OWNER}')`)
const m7 = await as('authenticated', MEMBER, `select scenario_id from public.list_shared_scenarios()`)
const m7g = await as('authenticated', MEMBER, `select public.scenario_access('${GUEST}') a`)
const m7cee = (await as('service_role', null, `select public.is_scenario_member('${GUEST}', '${MEMBER}') m`)).rows?.[0].m
row('M7', 'memberships on a GUEST or the member\'s OWN decision never surface (list, access, CEE read)', m7.ok && canon(m7.rows.map(r => r.scenario_id)) === canon([DEC]) && m7g.rows?.[0].a === 'none' && m7cee === false, { m7, m7g, m7cee })

// ── EVERY SUPABASE WRITE DOOR REFUSES A MEMBER (live bodies) ─────────────────────────────────────────────────────
const before = await decRow()
const w = {
  patchGraph: await as('authenticated', MEMBER, `select public.apply_patch_and_log('${DEC}', '{"nodes":[],"edges":[]}', 'e1', 'graph_saved')`),
  patchEvent: await as('authenticated', MEMBER, `select public.apply_patch_and_log('${DEC}', null, 'e2', 'note')`),
  append: await as('authenticated', MEMBER, `select public.append_scenario_event('${DEC}', 'e3', 'note')`),
  snapshot: await as('authenticated', MEMBER, `select public.create_shared_snapshot('${DEC}', '{"nodes":[]}', null, null, null, null, null)`),
  duplicate: await as('authenticated', MEMBER, `select public.duplicate_scenario('${DEC}')`),
  update: await as('authenticated', MEMBER, `update public.scenarios set title = 'hijacked' where id = '${DEC}'`),
  select: await as('authenticated', MEMBER, `select id from public.scenarios where id = '${DEC}'`),
}
row('W1', 'apply_patch_and_log (graph) refuses a member', !w.patchGraph.ok && /not owned by user/.test(w.patchGraph.err), w.patchGraph)
row('W2', 'apply_patch_and_log (event only) refuses a member', !w.patchEvent.ok && /not owned by user/.test(w.patchEvent.err), w.patchEvent)
row('W3', 'append_scenario_event refuses a member', !w.append.ok && /not owned by user/.test(w.append.err), w.append)
row('W4', 'create_shared_snapshot refuses a member (SS403)', !w.snapshot.ok && w.snapshot.code === 'SS403', w.snapshot)
row('W5', 'duplicate_scenario refuses a member', !w.duplicate.ok && /not owned by user/.test(w.duplicate.err), w.duplicate)
row('W6', 'a direct UPDATE through RLS touches 0 rows; a direct SELECT returns 0 rows (no RLS widening)', w.update.ok && w.update.affected === 0 && w.select.ok && w.select.rows.length === 0, { u: w.update, s: w.select })
row('W7', 'the decision row is byte-unchanged after every member attempt', (await decRow()) === before, {})

// ── REVOKE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const r0 = await as('authenticated', STRANGER, `select public.unshare_scenario('${DEC}', 'colleague@olumi.test') r`)
row('R0', 'a non-owner cannot revoke (SM403)', !r0.ok && r0.code === 'SM403', r0)
const l1 = await as('authenticated', OWNER, `select * from public.list_scenario_members('${DEC}')`)
const l1b = await as('authenticated', MEMBER, `select * from public.list_scenario_members('${DEC}')`)
row('L1', 'the owner lists active members; a member cannot (SM403)', l1.ok && canon(l1.rows.map(r => r.email).sort()) === canon(['colleague@olumi.test', 'no-account-yet@olumi.test', 'unconfirmed@olumi.test']) && !l1b.ok && l1b.code === 'SM403', { l1, l1b })
const r1 = await as('authenticated', OWNER, `select public.unshare_scenario('${DEC}', ' COLLEAGUE@olumi.test') r`)
const after = { list: (await as('authenticated', MEMBER, `select * from public.list_shared_scenarios()`)).rows, access: (await acc('authenticated', MEMBER)).rows?.[0].a, member: await isM(MEMBER) }
const kept = await q(`select count(*)::int n from public.scenario_members where scenario_id='${DEC}' and email='colleague@olumi.test' and revoked_at is not null`)
row('R1', 'the owner revokes: the member loses list, access and CEE read; the row is KEPT with revoked_at (no delete)', r1.ok && r1.rows[0].r.revoked === true
  && after.list.length === 0 && after.access === 'none' && after.member === false && kept[0].n === 1, { r1, after, kept })
const r2 = await share(OWNER, DEC, 'colleague@olumi.test')
row('R2', 'sharing again after a revoke restores access', r2.ok && (await acc('authenticated', MEMBER)).rows?.[0].a === 'viewer' && (await isM(MEMBER)) === true, r2)

// ── HARDENING ───────────────────────────────────────────────────────────────────────────────────────────────────
const meta = await q(`select p.proname, p.prosecdef, p.proconfig, coalesce((select array_agg(distinct a.grantee::regrole::text order by a.grantee::regrole::text) from aclexplode(p.proacl) a where a.privilege_type='EXECUTE'), '{}') ex
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('share_scenario','unshare_scenario','list_scenario_members','list_shared_scenarios','scenario_access','is_scenario_member','_scenario_member_email') order by p.proname`)
const wantEx = { share_scenario: ['authenticated', 'postgres'], unshare_scenario: ['authenticated', 'postgres'], list_scenario_members: ['authenticated', 'postgres'], list_shared_scenarios: ['authenticated', 'postgres'], scenario_access: ['authenticated', 'postgres'], is_scenario_member: ['postgres', 'service_role'], _scenario_member_email: ['postgres'] }
row('H1', 'every new function: SECURITY DEFINER, search_path=\'\', EXECUTE exactly as designed', meta.length === 7 && meta.every(m => m.prosecdef === true && canon(m.proconfig) === canon(['search_path=""']) && canon(m.ex) === canon(wantEx[m.proname])), meta)
await db.exec(`set role authenticated; create temp table scenario_members(scenario_id uuid, email text, revoked_at timestamptz); insert into scenario_members values ('${OTHERS_DEC}','stranger@olumi.test',null); reset role`)
const h2 = await as('authenticated', STRANGER, `select public.scenario_access('${OTHERS_DEC}') a`)
const h2b = await as('authenticated', STRANGER, `select * from public.list_shared_scenarios()`)
await db.exec('set role authenticated; drop table pg_temp.scenario_members; reset role')
row('H2', 'a caller\'s TEMP scenario_members cannot forge access', h2.ok && h2.rows[0].a === 'none' && h2b.ok && h2b.rows.length === 0, { h2, h2b })

const failed = results.filter(r => !r).length
console.log(`\n${results.length - failed}/${results.length} rows pass`)
if (results.length === 0 || failed > 0) process.exit(1)
