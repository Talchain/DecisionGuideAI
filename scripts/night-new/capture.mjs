import {chromium} from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
const origin='http://127.0.0.1:4132', out='/Users/paulslee/olumi-work/ui-evidence/look/night-new', item=process.env.ITEM ?? 'baseline'
mkdirSync(`${out}/${item}`,{recursive:true})
const browser=await chromium.launch(), results=[]
for (const tag of ['approved','pending']) {
 await fetch(`${origin}/night/select/${tag}`)
 const auth=await (await fetch(`${origin}/api/admin/people/1/reissue`,{method:'POST',headers:{'x-olumi-admin':'night-new-isolated-evidence-admin','content-type':'application/json'},body:'{}'})).json()
 const sid=tag==='approved'?'s_e399f8a9d922':'s_a30668165d74'
 for (const [w,h,dpr,label] of [[2000,1200,1,'2000'],[1128,707,1,'1128'],[1504,902,1.33,'133']]) {
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr})
  await ctx.addCookies([{name:'olumi',value:auth.link.slice(3),url:origin,httpOnly:true,sameSite:'Lax'}])
  const p=await ctx.newPage(), errors=[], refused=[]
  p.on('pageerror',e=>errors.push(e.message.slice(0,180)))
  await p.route('**/*',r=>{const q=r.request(),u=new URL(q.url()); if(u.origin!==origin){return r.abort()} if(u.pathname.startsWith('/api/')&&q.method()!=='GET'){refused.push(u.pathname);return r.abort()} return r.continue()})
  await p.goto(`${origin}/#/scenario/00000000-0000-4000-8000-${sid.slice(2)}`)
  await p.waitForSelector('[data-testid="view-canvas"]',{timeout:45000}); await p.waitForTimeout(6000)
  const file=`${out}/${item}/${tag}-${label}-open.png`;await p.screenshot({path:file})
  const dom=await p.evaluate(()=>({zoom:new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a,
   nodes:[...document.querySelectorAll('.react-flow__node')].map(n=>{const r=n.getBoundingClientRect();return {id:n.dataset.id,family:n.querySelector('[data-ok-family]')?.dataset.okFamily,x:r.x,y:r.y,w:r.width,h:r.height,text:n.innerText}}),
   panel:document.querySelector('[data-testid="view-chat"]')?.innerText,
   controls:[...document.querySelectorAll('button')].map(n=>({text:n.innerText,test:n.dataset.testid,title:n.title,aria:n.getAttribute('aria-label')}))}))
  const view=await p.evaluate(async s=>(await fetch(`/api/scenarios/${s}/view?schema=3`)).json(),sid)
  writeFileSync(`${out}/${item}/${tag}-view.json`,JSON.stringify(view))
  // Prove overflow remains reachable using the served page's own pan cue.
  const cue=p.locator('[data-testid="view-below-cue"] button').first()
  if(await cue.count()){await cue.click();await p.waitForTimeout(800);await p.screenshot({path:`${out}/${item}/${tag}-${label}-pan.png`})}
  results.push({tag,label,file,errors,refused,dom})
  await ctx.close()
 }
}
await browser.close();writeFileSync(`${out}/${item}/results.json`,JSON.stringify(results,null,2));console.log(results.map(r=>({tag:r.tag,size:r.label,zoom:r.dom.zoom,nodes:r.dom.nodes.length,errors:r.errors,refused:r.refused})))
