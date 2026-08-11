const BASE='https://staging--olumi.netlify.app';
const seen=new Set(); const q=['/assets/index-COspGXQe.js'];
const found=new Map();
while(q.length){
  const p=q.shift(); if(seen.has(p))continue; seen.add(p);
  let t; try{ const r=await fetch(BASE+p); if(!r.ok){continue;} t=await r.text(); }catch(e){continue;}
  found.set(p,t.length);
  for(const m of t.matchAll(/["'`]([./][A-Za-z0-9._\-/]*?\.js)["'`]/g)){
    let u=m[1];
    if(u.startsWith('./')) u='/assets/'+u.slice(2);
    else if(!u.startsWith('/assets/')&&u.startsWith('/')) {}
    if(!seen.has(u)) q.push(u);
  }
  for(const m of t.matchAll(/(assets\/[A-Za-z0-9._-]+\.js)/g)){
    const u='/'+m[1]; if(!seen.has(u)) q.push(u);
  }
}
console.log('CHUNKS_CRAWLED='+found.size);
let bytes=0; for(const v of found.values()) bytes+=v;
console.log('TOTAL_BYTES='+bytes);
// now search
const hits={supabaseUrl:new Set(),authMode:new Set(),requireLogin:0,stub:0,signInWithOtp:0,gotrue:0};
for(const p of found.keys()){
  const t=await (await fetch(BASE+p)).text();
  for(const m of t.matchAll(/https:\/\/[a-z0-9]{10,}\.supabase\.co/g)) hits.supabaseUrl.add(m[0]);
  if(/signInWithOtp/.test(t)) hits.signInWithOtp++;
  if(/GoTrueClient/.test(t)) hits.gotrue++;
  if(/feature\.requireLogin/.test(t)) hits.requireLogin++;
  if(/prevents real SDK|supabase stub/i.test(t)) hits.stub++;
}
console.log('SUPABASE_URLS='+JSON.stringify([...hits.supabaseUrl]));
console.log('signInWithOtp_chunks='+hits.signInWithOtp, 'GoTrueClient_chunks='+hits.gotrue, 'feature.requireLogin_chunks='+hits.requireLogin, 'stubmarker_chunks='+hits.stub);
