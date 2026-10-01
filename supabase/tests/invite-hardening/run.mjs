import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const [,, migPath] = process.argv;
const db = new PGlite();
await db.exec(fs.readFileSync(new URL('setup.sql', import.meta.url),'utf8') + fs.readFileSync(new URL('before.sql', import.meta.url),'utf8'));
if (migPath) await db.exec(fs.readFileSync(migPath,'utf8'));
const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', C='00000000-0000-0000-0000-00000000000c';
const O='00000000-0000-0000-0000-0000000000f1', T='00000000-0000-0000-0000-0000000000e1';
const I_ok='00000000-0000-0000-0000-000000000101', I_self='00000000-0000-0000-0000-000000000102', I_c='00000000-0000-0000-0000-000000000103';
await db.exec(`insert into auth.users values ('${A}','a@x.test'),('${B}','b@x.test'),('${C}','c@x.test');
insert into organisations values ('${O}','OrgA','${A}','orga','team');
insert into organisation_members values ('${O}','${A}','owner');
insert into teams(id,name,created_by) values ('${T}','TeamA','${A}');
insert into canvases values ('00000000-0000-0000-0000-0000000000c1','${A}','${O}');
insert into invitations(id,email,status,invited_by,organisation_id) values
 ('${I_ok}','b@x.test','pending','${A}','${O}'),
 ('${I_self}','b@x.test','pending','${B}','${O}'),
 ('${I_c}','c@x.test','pending','${A}','${O}');`);
async function as(role, uid, sql) {
  const claims = uid ? JSON.stringify({sub:uid, role}) : JSON.stringify({role});
  try {
    await db.exec(`set role ${role}`);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    const r = await db.query(sql);
    return { ok: true, rows: r.rows };
  } catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role'); }
}
const res = {};
const t = (k, v) => { res[k] = v; };
// grants
t('G1 anon accept denied', !(await as('anon', null, `select accept_organization_invitation('${I_ok}','${B}')`)).ok);
t('G2 anon can_create_organization denied', !(await as('anon', null, `select can_create_organization('${A}','team')`)).ok);
t('G3 auth can_create_organization allowed (RLS dep)', (await as('authenticated', B, `select can_create_organization('${B}','team')`)).ok);
t('G4 auth send_email_with_template denied', !(await as('authenticated', B, `select send_email_with_template('v@x.test','s','t')`)).ok);
t('G5 auth manage_team_invite(p_*) denied', !(await as('authenticated', B, `select manage_team_invite('${T}'::uuid,'b@x.test'::text,'${A}'::uuid,'admin'::text)`)).ok);
// accept
let r = await as('authenticated', B, `select accept_organization_invitation('${I_c}','${C}') j`);
t('A1 B cannot accept C invite with C id', r.ok && r.rows[0].j.success === false);
r = await as('authenticated', B, `select accept_organization_invitation('${I_self}','${B}') j`);
t('A2 self-invite into foreign org refused', r.ok && r.rows[0].j.success === false);
r = await as('authenticated', B, `select accept_organization_invitation('${I_ok}','${B}') j`);
t('A3 CONTROL real invite accepted', r.ok && r.rows[0].j.success === true);
r = await db.query(`select count(*)::int n from organisation_members where user_id='${B}' and organisation_id='${O}'`);
t('A4 CONTROL B is member after accept', r.rows[0].n === 1);
// manage_team_member
t('M1 non-admin B cannot add self as team admin', !(await as('authenticated', B, `select * from manage_team_member('${T}','b@x.test','admin','owner')`)).ok);
r = await as('authenticated', A, `select * from manage_team_member('${T}','c@x.test','member','viewer')`);
t('M2 CONTROL team creator A can add C', r.ok && r.rows.length === 1);
// get_teams_with_members
r = await as('authenticated', B, `select * from get_teams_with_members('${A}')`);
t('W1 B cannot read A teams', r.ok && r.rows.length === 0);
r = await as('authenticated', A, `select * from get_teams_with_members('${A}')`);
t('W2 CONTROL A reads own teams', r.ok && r.rows.length === 1);
// track / send
t('S1 non-inviter C cannot write invite log', !(await as('authenticated', C, `select track_invitation_status('${I_ok}','x','{}')`)).ok);
t('S2 CONTROL inviter A writes log', (await as('authenticated', A, `select track_invitation_status('${I_c}','x','{}')`)).ok);
r = await as('authenticated', B, `select send_team_invitation_email('${I_c}','victim@x.test','T') j`);
t('S3 B cannot relay email', r.ok ? r.rows[0].j.success === false : true);
r = await as('authenticated', A, `select send_team_invitation_email('${I_c}','c@x.test','T') j`);
t('S4 CONTROL inviter A sends to invitee', r.ok && r.rows[0].j.success === true);
r = await as('service_role', null, `select track_invitation_status('${I_c}','svc','{}')`);
t('S5 CONTROL service_role writes log', r.ok);
let pass=0; for (const [k,v] of Object.entries(res)) { console.log((v?'PASS ':'FAIL ')+k); if (v) pass++; }
console.log(`${pass}/${Object.keys(res).length}`);
