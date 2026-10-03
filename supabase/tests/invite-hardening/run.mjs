// Dry-run of the invite/team migrations on PGlite (in-process Postgres).
// Never touches Supabase. Usage:
//   node run.mjs                         # BEFORE (live bodies + live grants)
//   node run.mjs a.sql b.sql c.sql       # AFTER, applying the files in order
// Every row binds to exact identities (ids, error text, row tuples). Exits 1
// if any row fails, so a red run cannot read as green.
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'

const migrations = process.argv.slice(2)
const db = new PGlite()
await db.exec(fs.readFileSync(new URL('setup.sql', import.meta.url), 'utf8'))
await db.exec(fs.readFileSync(new URL('before.sql', import.meta.url), 'utf8'))
for (const m of migrations) await db.exec(fs.readFileSync(m, 'utf8'))

const U = n => `00000000-0000-0000-0000-0000000000${n}`
const A = U('0a'), B = U('0b'), C = U('0c'), D = U('0d'), E = U('0e'), F = U('0f'), G = U('10'), H = U('11'), J = U('12'), P = U('13'), Q = U('14'), R2 = U('15')
const O = U('f1'), X = U('f2'), Y = U('f3'), T = U('e1'), TB = U('e2'), K = U('c1')
const I = {
  ok: U('a1'), self: U('a2'), forC: U('a3'), team: U('a4'), editor: U('a5'),
  foreign: U('a6'), hostile: U('aa'), race: U('ab'), prod: U('ac'), prodByTeamAdmin: U('ad'), prodHostile: U('ae'), rlsTeam: U('af'), fail: U('a7'), pre: U('a8'), relay: U('a9'),
}
await db.exec(`
insert into auth.users values ('${A}','a@x.test'),('${B}','b@x.test'),('${C}','c@x.test'),('${D}','d@x.test'),
  ('${E}','e@x.test'),('${F}','f@x.test'),('${G}','g@x.test'),('${H}','h@x.test'),('${J}','j@x.test'),('${P}','p@x.test'),('${Q}','q@x.test'),('${R2}','r@x.test');
insert into user_profiles(id,email,display_name) select id, email, null from auth.users;
update user_profiles set display_name = 'Ada Owner' where id = '${A}';
insert into organisations values ('${O}','OrgO','${A}','orgo','team'),('${X}','OrgX','${B}','orgx','team'),('${Y}','OrgY','${H}','orgy','team');
insert into organisation_members(organisation_id,user_id,role) values ('${O}','${A}','owner'),('${X}','${B}','owner'),('${O}','${G}','member'),('${O}','${H}','member'),('${Y}','${H}','owner'),('${O}','${Q}','member');
insert into teams(id,name,created_by,organisation_id) values ('${T}','TeamT','${A}','${O}');
insert into team_members(team_id,user_id,role,decision_role) values ('${T}','${G}','member','viewer'),('${T}','${Q}','admin','owner');
insert into canvases values ('${K}','${A}','${O}');
insert into invitations(id,email,status,invited_by,organisation_id,team_id,role,decision_role) values
 ('${I.ok}','c@x.test','pending','${A}','${O}',null,'member',null),
 ('${I.self}','b@x.test','pending','${B}','${O}',null,'admin',null),
 ('${I.forC}','c@x.test','pending','${A}','${O}',null,'member',null),
 ('${I.team}','d@x.test','pending','${A}','${O}','${T}','member','contributor'),
 ('${I.editor}','e@x.test','pending','${A}','${O}','${T}','member','editor'),
 ('${I.foreign}','b@x.test','pending','${B}','${X}','${T}','admin','admin'),
 ('${I.fail}','f@x.test','pending','${A}','${O}','${T}','member','viewer'),
 ('${I.pre}','g@x.test','pending','${A}','${O}','${T}','member','viewer'),
 ('${I.relay}','victim@evil.test','pending','${B}','${O}',null,'member',null),
 ('${I.hostile}','h@x.test','pending','${H}','${Y}','${T}','admin','admin'),
 ('${I.race}','j@x.test','pending','${A}','${O}','${T}','member','viewer');
-- PRODUCTION-SHAPED rows: exactly what TeamsContext.tsx:189 (main 7b5992fc) writes,
-- { email, team_id, invited_by, role, decision_role, status } with NO organisation_id.
insert into invitations(id,email,team_id,invited_by,role,decision_role,status) values
 ('${I.prod}','p@x.test','${T}','${A}','member','contributor','pending'),
 ('${I.prodByTeamAdmin}','r@x.test','${T}','${Q}','member','viewer','pending'),
 ('${I.prodHostile}','h@x.test','${T}','${H}','admin','owner','pending');
-- Test-only fault injection: a team_members insert for F fails AFTER the org insert.
create function public._fail_for_f() returns trigger language plpgsql as $$
BEGIN
  IF NEW.user_id = '${F}' THEN RAISE EXCEPTION 'injected failure'; END IF;
  -- a concurrent insert of the same (team, user) surfaces as unique_violation
  IF NEW.user_id = '${J}' THEN RAISE EXCEPTION 'concurrent team insert' USING ERRCODE = 'unique_violation'; END IF;
  RETURN NEW;
END; $$;
create trigger zz_fail_for_f before insert on public.team_members for each row execute function public._fail_for_f();
`)

async function as(role, uid, sql) {
  const claims = JSON.stringify(uid ? { sub: uid, role } : { role })
  try {
    await db.exec(`set role ${role}`)
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
    const r = await db.query(sql)
    return { ok: true, rows: r.rows }
  } catch (e) {
    return { ok: false, err: e.message }
  } finally {
    await db.exec('reset role')
  }
}
async function asMulti(role, uid, setup, sql) {
  const claims = JSON.stringify(uid ? { sub: uid, role } : { role })
  try {
    await db.exec(`set role ${role}`)
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
    await db.exec(setup)
    const r = await db.query(sql)
    return { ok: true, rows: r.rows }
  } catch (e) {
    return { ok: false, err: e.message }
  } finally {
    await db.exec('reset role')
  }
}
const q = async sql => (await db.query(sql)).rows
const one = async sql => (await q(sql))[0]
const denied = r => !r.ok && /permission denied for function/.test(r.err)

const results = []
const t = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

// ── Grants (from 20261001193210) ─────────────────────────────────────────
t('G1 anon cannot execute accept', denied(await as('anon', null, `select public.accept_organization_invitation('${I.ok}','${C}')`)))
t('G2 anon cannot execute can_create_organization', denied(await as('anon', null, `select public.can_create_organization('${A}','team')`)))
t('G3 CONTROL authenticated can execute can_create_organization (RLS dependency)', (await as('authenticated', B, `select public.can_create_organization('${B}','team')`)).ok)
t('G4 authenticated cannot execute send_email_with_template', denied(await as('authenticated', B, `select public.send_email_with_template('v@x.test','s','t')`)))
t('G5 authenticated cannot execute manage_team_invite(p_*)', denied(await as('authenticated', B, `select public.manage_team_invite('${T}'::uuid,'b@x.test'::text,'${A}'::uuid,'admin'::text)`)))

// ── Accept ───────────────────────────────────────────────────────────────
let r = await as('authenticated', B, `select public.accept_organization_invitation('${I.forC}','${C}') j`)
t('A1 B cannot accept C’s invitation by passing C’s id', r.ok && r.rows[0].j.success === false
  && (await one(`select status from public.invitations where id='${I.forC}'`)).status === 'pending')

r = await as('authenticated', B, `select public.accept_organization_invitation('${I.self}','${B}') j`)
t('A2 self-authored invite into a foreign org is refused', r.ok && r.rows[0].j.success === false
  && (await one(`select count(*)::int n from public.organisation_members where organisation_id='${O}' and user_id='${B}'`)).n === 0)

// T1 (P1-3): a caller-created TEMP table must not shadow the authority lookup.
r = await asMulti('authenticated', B, `
  create temp table organisation_members(organisation_id uuid, user_id uuid, role text);
  insert into pg_temp.organisation_members values ('${O}','${B}','owner');
  create temp table organisations(id uuid, name text, owner_id uuid);
  insert into pg_temp.organisations values ('${O}','OrgO','${B}');`,
  `select public.accept_organization_invitation('${I.self}','${B}') j`)
const shadowSeen = r.ok  // the call itself must have run, or T1 proves nothing
await db.exec(`drop table if exists pg_temp.organisation_members; drop table if exists pg_temp.organisations`)
const leftover = (await one(`select count(*)::int n from pg_class where relpersistence = 't'`)).n
t('T0 harness: no TEMP table survives the shadowing row', leftover === 0)
t('T1 TEMP-table shadowing grants nothing (real org membership absent)',
  shadowSeen && (await one(`select count(*)::int n from public.organisation_members where organisation_id='${O}' and user_id='${B}'`)).n === 0
  && (await one(`select status from public.invitations where id='${I.self}'`)).status === 'pending', r.err ?? '')

r = await as('authenticated', B, `select public.accept_organization_invitation('${I.foreign}','${B}') j`)
t('A5a org-X owner (not in org O) cannot reach org-O’s team', r.ok && r.rows[0].j.success === false
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${B}'`)).n === 0)

// A5b is Codex's P1-1 exactly: H is a plain MEMBER of org O (so the team_members
// trigger passes) and OWNER of org Y; H self-invites with org Y + O's team T.
r = await as('authenticated', H, `select public.accept_organization_invitation('${I.hostile}','${H}') j`)
t('A5b org-Y owner who is a plain org-O member cannot make themselves admin of org-O’s team (P1-1)',
  r.ok && r.rows[0].j.success === false
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${H}'`)).n === 0,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))

r = await as('authenticated', C, `select public.accept_organization_invitation('${I.ok}','${C}') j`)
t('A3 CONTROL a real org invitation is accepted', r.ok && r.rows[0].j.success === true
  && (await one(`select status from public.invitations where id='${I.ok}'`)).status === 'accepted')
t('A4 CONTROL exact membership tuple (O, C, member) + canvas viewer',
  (await one(`select count(*)::int n from public.organisation_members where organisation_id='${O}' and user_id='${C}' and role='member'`)).n === 1
  && (await one(`select count(*)::int n from public.canvas_permissions where canvas_id='${K}' and user_id='${C}' and permission_type='viewer'`)).n === 1)

r = await as('authenticated', D, `select public.accept_organization_invitation('${I.team}','${D}') j`)
t('A6 CONTROL team-backed invite (contributor) is accepted under the real CHECK constraints (P1-4)',
  r.ok && r.rows[0].j.success === true
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${D}' and role='member' and decision_role='contributor'`)).n === 1
  && (await one(`select count(*)::int n from public.organisation_members where organisation_id='${O}' and user_id='${D}' and role='member'`)).n === 1,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))

r = await as('authenticated', E, `select public.accept_organization_invitation('${I.editor}','${E}') j`)
t('A7 live decision_role ‘editor’ maps to contributor; acceptance still succeeds',
  r.ok && r.rows[0].j.success === true
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${E}' and decision_role='contributor'`)).n === 1,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))

r = await as('authenticated', F, `select public.accept_organization_invitation('${I.fail}','${F}') j`)
t('C1 a failure after the org insert leaves NOTHING behind and the invitation pending (P1-5)',
  r.ok && r.rows[0].j.success === false
  && (await one(`select status from public.invitations where id='${I.fail}'`)).status === 'pending'
  && (await one(`select count(*)::int n from public.organisation_members where user_id='${F}'`)).n === 0)

r = await as('authenticated', J, `select public.accept_organization_invitation('${I.race}','${J}') j`)
t('C3 a unique_violation after the org insert is NOT reported as success and the invitation stays pending (P1-5)',
  r.ok && r.rows[0].j.success === false
  && (await one(`select status from public.invitations where id='${I.race}'`)).status === 'pending'
  && (await one(`select count(*)::int n from public.organisation_members where user_id='${J}'`)).n === 0,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))

r = await as('authenticated', G, `select public.accept_organization_invitation('${I.pre}','${G}') j`)
t('C2 CONTROL existing org + team rows (conflict path) still accept, roles untouched',
  r.ok && r.rows[0].j.success === true
  && (await one(`select status from public.invitations where id='${I.pre}'`)).status === 'accepted'
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${G}' and role='member' and decision_role='viewer'`)).n === 1)

// ── Production-shaped team invitations (round 3) ─────────────────────────
// PS1 runs while the invitation is still pending (PA1 accepts it below).
await q(`delete from public.email_outbox`)
r = await as('authenticated', A, `select public.send_team_invitation_email('${I.prod}','p@x.test','TeamT','Ada') j`)
const prodSent = await q(`select to_addr, subject, data from public.email_outbox`)
t('PS1 CONTROL production-shaped team invite (no organisation_id): the REAL helper body sends through the transport',
  r.ok && r.rows[0].j.success === true && prodSent.length === 1 && prodSent[0].to_addr === 'p@x.test'
  && prodSent[0].data.htmlContent.includes(`token=${I.prod}`),
  r.err ?? JSON.stringify(r.rows?.[0]?.j))

r = await as('authenticated', P, `select public.accept_organization_invitation('${I.prod}','${P}') j`)
t('PA1 CONTROL production-shaped team invite (no organisation_id) is accepted into the team\u2019s org',
  r.ok && r.rows[0].j.success === true
  && (await one(`select count(*)::int n from public.organisation_members where organisation_id='${O}' and user_id='${P}' and role='member'`)).n === 1
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${P}' and role='member' and decision_role='contributor'`)).n === 1,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))
r = await as('authenticated', R2, `select public.accept_organization_invitation('${I.prodByTeamAdmin}','${R2}') j`)
t('PA2 CONTROL production-shaped invite issued by a TEAM admin (not an org admin) is accepted',
  r.ok && r.rows[0].j.success === true
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${R2}' and role='member' and decision_role='viewer'`)).n === 1,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))
r = await as('authenticated', H, `select public.accept_organization_invitation('${I.prodHostile}','${H}') j`)
t('PA3 production-shaped SELF-invite by a plain org member (no team or org authority) is refused',
  r.ok && r.rows[0].j.success === false
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${H}'`)).n === 0,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))

// RLS1 (round-3 P1): through the REAL teams/invitations RLS, an outsider B
// (no membership of org O) creates a team claiming org O, self-invites as
// team admin and accepts. Nothing may change.
r = await asMulti('authenticated', B, `
  insert into public.teams(id, name, created_by, organisation_id) values ('${TB}', 'Claimed', '${B}', '${O}');
  insert into public.invitations(id, email, team_id, invited_by, role, decision_role, status)
    values ('${I.rlsTeam}', 'b@x.test', '${TB}', '${B}', 'admin', 'owner', 'pending');`,
  `select public.accept_organization_invitation('${I.rlsTeam}', '${B}') j`)
const rlsSetupRan = (await one(`select count(*)::int n from public.teams where id='${TB}' and created_by='${B}' and organisation_id='${O}'`)).n === 1
t('RLS1 an outsider\u2019s self-created team claiming org O grants nothing (round-3 P1)',
  rlsSetupRan && r.ok && r.rows[0].j.success === false
  && (await one(`select status from public.invitations where id='${I.rlsTeam}'`)).status === 'pending'
  && (await one(`select count(*)::int n from public.organisation_members where organisation_id='${O}' and user_id='${B}'`)).n === 0
  && (await one(`select count(*)::int n from public.team_members where user_id='${B}'`)).n === 0
  && (await one(`select count(*)::int n from public.canvas_permissions where user_id='${B}'`)).n === 0,
  r.err ?? JSON.stringify(r.rows?.[0]?.j))

// ── manage_team_member ───────────────────────────────────────────────────
r = await as('authenticated', B, `select * from public.manage_team_member('${T}','b@x.test','admin','owner')`)
t('M1 non-admin is refused with the AUTHORISATION error, and no row is written',
  !r.ok && /Not authorized to manage team members/.test(r.err)
  && (await one(`select count(*)::int n from public.team_members where team_id='${T}' and user_id='${B}'`)).n === 0, r.err ?? 'call succeeded')
r = await as('authenticated', A, `select * from public.manage_team_member('${T}','c@x.test','member','viewer')`)
t('M2 CONTROL team creator adds org member C: exact row returned', r.ok && r.rows.length === 1
  && r.rows[0].team_id === T && r.rows[0].user_id === C && r.rows[0].role === 'member', r.err ?? '')

// ── get_teams_with_members ───────────────────────────────────────────────
r = await as('authenticated', B, `select * from public.get_teams_with_members('${A}')`)
t('W1 B cannot read A’s teams (or their emails)', r.ok && r.rows.length === 0)
r = await as('authenticated', A, `select * from public.get_teams_with_members('${A}')`)
t('W2 CONTROL A reads exactly TeamT', r.ok && r.rows.length === 1 && r.rows[0].id === T)

// ── track / send ─────────────────────────────────────────────────────────
r = await as('authenticated', C, `select public.track_invitation_status('${I.team}','x','{}')`)
t('S1 non-inviter cannot write an invitation log (authorisation error, no row)',
  !r.ok && /Not authorized/.test(r.err)
  && (await one(`select count(*)::int n from public.invitation_logs where invitation_id='${I.team}' and status='x'`)).n === 0, r.err ?? 'call succeeded')
r = await as('authenticated', A, `select public.track_invitation_status('${I.team}','by-inviter','{}')`)
t('S2 CONTROL the inviter writes exactly one log row', r.ok
  && (await one(`select count(*)::int n from public.invitation_logs where invitation_id='${I.team}' and status='by-inviter'`)).n === 1)
r = await as('service_role', null, `select public.track_invitation_status('${I.team}','svc','{}')`)
t('S5 CONTROL service_role writes a log row', r.ok
  && (await one(`select count(*)::int n from public.invitation_logs where invitation_id='${I.team}' and status='svc'`)).n === 1)

await q(`delete from public.email_outbox`)
r = await as('authenticated', B, `select public.send_team_invitation_email('${I.relay}','victim@evil.test','Evil Co','Mallory','https://evil.test') j`)
t('S3 a self-authored invitation without scope authority cannot send email (P1-2)',
  (await one(`select count(*)::int n from public.email_outbox`)).n === 0, r.err ?? JSON.stringify(r.rows?.[0]?.j))

await db.exec(`update public.invitations set status='pending' where id='${I.team}'`)
r = await as('authenticated', A, `select public.send_team_invitation_email('${I.team}','d@x.test','EVIL NAME','Mallory','https://evil.test') j`)
const sent = await q(`select to_addr, subject, data from public.email_outbox`)
t('S4 CONTROL the inviter sends one email to the invitee', r.ok && sent.length === 1 && sent[0].to_addr === 'd@x.test', r.err ?? '')
t('S6 names come from stored rows; the link is the pinned origin + THIS invitation id (P1-2)',
  sent.length === 1 && sent[0].subject.includes('TeamT') && !sent[0].subject.includes('EVIL')
  && sent[0].data.htmlContent.includes('Ada Owner') && !sent[0].data.htmlContent.includes('Mallory')
  && sent[0].data.htmlContent.includes(`href="https://decisionguide.ai/teams/join?token=${I.team}"`),
  JSON.stringify(sent[0] ?? null).slice(0, 300))


// ── Report ───────────────────────────────────────────────────────────────
let pass = 0
for (const x of results) {
  console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${!x.pass && x.detail ? `  [${String(x.detail).slice(0, 140)}]` : ''}`)
  if (x.pass) pass++
}
console.log(`${pass}/${results.length}`)
if (pass !== results.length) process.exitCode = 1
