// ROUND 4 — settle the LADDER honestly, with the corrected classifier and an
// ACTUAL confirmation turn. Rounds 1-3 never sent one: every "confirm" in those
// scripts was the classifier's own regex over assistant prose.
//
// Rounds 1-3, re-classified: NO add was accepted across 12 arms. F/G were
// REJECTED `PIPELINE_OWNED_FIELD` — "the candidate targets an analysis-derived,
// pipeline-owned field". That is a fact about the TARGET I picked (Budget
// Headroom is analysis-derived), not proof that no add can land. So this round
// aims at targets that are NOT pipeline-owned, and if any is HELD it sends the
// confirmation and checks whether the graph actually moved.
//
// Whatever comes back is the answer that ships. If nothing lands, the source
// comment says the ladder is unmeasured rather than reassuring the reader.
import fs from 'node:fs'; import { randomUUID } from 'node:crypto';
import { sendBufferedTurn, sendStreamedTurn, targets } from '/Users/paulslee/Documents/GitHub/scripts/golden-journey/lib/wire.mjs';
import { classifyOutcome } from './classifier.mjs';
const OUT='/private/tmp/link-r2-lane-8f3c2a/evidence/addthis-probe-r4'; fs.mkdirSync(OUT,{recursive:true});
const log=(...a)=>{const l=`[${new Date().toISOString()}] ${a.join(' ')}`;console.log(l);fs.appendFileSync(`${OUT}/probe.log`,l+'\n');};
const BRIEF=`Should we replace our current CRM with HubSpot next quarter, or keep what we have? We are a 34-person B2B sales team with annual revenue of £31m. Annual CRM cost is about £50,000 and switching would cost roughly £20,000 one-off. The goal is higher sales productivity without blowing the budget.`;
const ARMS=[
 {id:'M_TARGET_PLAIN_FACTOR', note:'targets a plain brief-derived factor, not an analysis-derived one',
  message:`Add a new factor called "Annual revenue" with a value of £31m, and connect it so that it influences Annual CRM Licence Cost.`},
 {id:'N_TARGET_ADOPTION', note:'targets the adoption factor — also brief-derived',
  message:`Add a new factor called "Annual revenue" with a value of £31m, and connect it so that it influences Sales Team Adoption Rate.`},
 {id:'O_CONTROL_KNOWN_GOOD', note:'POSITIVE CONTROL — the proven edit grammar. If this fails the service is sick and no arm may be read.',
  message:`Change Annual CRM Licence Cost to £64,000.`},
];
async function runArm(a){
  const scenarioId=randomUUID();
  log(`${a.id}: scenario=${scenarioId} drafting…`);
  const t1=await sendStreamedTurn({id:`${a.id}_DRAFT`,scenarioId,message:BRIEF});
  if(!t1.graphReady){log(`${a.id}: NO DRAFT — unmeasured`);return {arm:a.id,outcome:{kind:'UNMEASURED_NO_DRAFT'}};}
  const before=(t1.graphReady.nodes||[]).length;
  const t2=await sendBufferedTurn({id:`${a.id}_ADD`,scenarioId,message:a.message});
  const c=classifyOutcome(t2);
  log(`${a.id}: ADD -> ${c.kind} verdict=${c.verdict} ${JSON.stringify(c.codes)} markers=${JSON.stringify(c.markers)}`);
  const rec={arm:a.id,note:a.note,message:a.message,scenarioId,nodesBefore:before,add:{kind:c.kind,verdict:c.verdict,codes:c.codes,
    blockTypes:(t2.body?.blocks||[]).map(x=>x?.type),text:String(t2.body?.assistant_text||t2.body?.message||'').slice(0,600)},confirm:null};
  // ── THE STEP ROUNDS 1-3 NEVER TOOK ──
  if(c.kind==='HELD'){
    log(`${a.id}: HELD — sending a REAL confirmation turn…`);
    const t3=await sendBufferedTurn({id:`${a.id}_CONFIRM`,scenarioId,message:'Yes'});
    const c3=classifyOutcome(t3);
    const g=t3.body?.draft_graph||null;
    const newLabels=g?(g.nodes||[]).map(n=>n.label).filter(l=>!(t1.graphReady.nodes||[]).some(n=>n.label===l)):null;
    rec.confirm={kind:c3.kind,verdict:c3.verdict,codes:c3.codes,nodesAfter:g?(g.nodes||[]).length:null,newLabels,
      text:String(t3.body?.assistant_text||t3.body?.message||'').slice(0,600)};
    log(`${a.id}: CONFIRM -> ${c3.kind} nodes ${before}->${rec.confirm.nodesAfter} new=${JSON.stringify(newLabels)}`);
    fs.writeFileSync(`${OUT}/${a.id}-confirm.json`,JSON.stringify(t3.body,null,2));
  }
  fs.writeFileSync(`${OUT}/${a.id}.json`,JSON.stringify({...rec,addFullBody:t2.body},null,2));
  return rec;
}
log(`target=${targets.ceeTurnBase} arms=${ARMS.length}`);
const results=await Promise.all(ARMS.map(a=>runArm(a).catch(e=>({arm:a.id,error:String(e)}))));
fs.writeFileSync(`${OUT}/summary.json`,JSON.stringify({brief:BRIEF,results},null,2));
log('===== SUMMARY =====');
for(const r of results) log(`${String(r.arm).padEnd(24)} add=${r.add?.kind||r.outcome?.kind} ${JSON.stringify(r.add?.codes||[])} confirm=${r.confirm?r.confirm.kind+' nodes->'+r.confirm.nodesAfter:'(not sent — add was not held)'}`);
const ctl=results.find(r=>r.arm==='O_CONTROL_KNOWN_GOOD');
log(`POSITIVE CONTROL: ${ctl?.add?.kind}`);
