import {chromium} from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
const origin='http://127.0.0.1:4132',out='/Users/paulslee/olumi-work/ui-evidence/look/night-new/05-failure',oldSid='s_a30668165d74',results=[]
const brief=JSON.parse(readFileSync('/Users/paulslee/olumi-work/ui-evidence/look/night-new/04-explanation/approved-view.json','utf8')).brief
mkdirSync(out,{recursive:true});const b=await chromium.launch()
for(const [w,h,dpr,label] of [[2000,1200,1,'2000'],[1128,707,1,'1128'],[1504,902,1.33,'133']]){
 await fetch(`${origin}/night/select/failure-${label}`)
 const auth=await(await fetch(`${origin}/api/admin/people/1/reissue`,{method:'POST',headers:{'x-olumi-admin':'night-new-isolated-evidence-admin','content-type':'application/json'},body:'{}'})).json()
 const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr});await ctx.addCookies([{name:'olumi',value:auth.link.slice(3),url:origin,httpOnly:true,sameSite:'Lax'}]);const p=await ctx.newPage(),posts=[],refused=[]
 await p.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==origin)return r.abort();if(u.pathname.startsWith('/api/')&&q.method()!=='GET'){if(u.pathname==='/api/scenarios'||/\/draft$/.test(u.pathname)){const res=await r.fetch();posts.push({path:u.pathname,status:res.status()});return r.fulfill({response:res})}refused.push(u.pathname);return r.abort()}return r.continue()})
 await p.goto(`${origin}/#/scenario/00000000-0000-4000-8000-${oldSid.slice(2)}`);await p.waitForSelector('[data-testid="view-welcome"]');await p.locator('#view-chat-text').fill(brief);await p.screenshot({path:`${out}/draft-${label}-brief.png`});await p.locator('[data-testid="view-composer-send"]').click()
 const running=p.locator('[data-testid="view-drafting-board"][data-draft="drafting"]');let sawRunning=false
 try{await running.waitFor({timeout:6000});sawRunning=true;await p.screenshot({path:`${out}/draft-${label}-building.png`})}catch{}
 await p.locator('[data-testid="view-drafting-board"][data-draft="failed"]').waitFor({timeout:20000});await p.screenshot({path:`${out}/draft-${label}-failed.png`})
 const retry=p.locator('[data-testid="view-drafting-again"]');const retryCount=await retry.count();await retry.click()
 let retryRunning=false;try{await running.waitFor({timeout:6000});retryRunning=true}catch{}
 await p.locator('[data-testid="view-drafting-board"][data-draft="failed"]').waitFor({timeout:20000});await p.locator('[data-testid="view-draft-brief"] > summary').click();await p.screenshot({path:`${out}/draft-${label}-retry-failed.png`})
 const retained=await p.locator('[data-testid="view-draft-brief"] p').textContent();await p.reload();await p.waitForSelector('[data-testid="view-drafting-board"][data-draft="failed"]');await p.screenshot({path:`${out}/draft-${label}-reopen.png`})
 results.push({label,sawRunning,retryRunning,retryCount,retained:retained===brief,posts,refused,passed:sawRunning&&retryRunning&&retryCount===1&&retained===brief&&posts.length===2&&posts.every(x=>x.status===202)&&refused.length===0});await ctx.close()
}
await b.close();writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(results)
