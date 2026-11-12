/**
 * PL-581 (Codex's counter, PL-e082-editor-race.scratch.spec.tsx, kept as written as the first row): an unrelated newer View must not
 * erase a person's unsaved correction, nor move it onto the newer base. Core's European View fixture (core output, in the repo).
 */
import '@testing-library/jest-dom/vitest'
import {readFileSync} from 'node:fs'
import {describe,it,expect,afterEach} from 'vitest'
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react'
import {Panel} from '../Panel'
import {setTeamFetch, setPagePerson} from '../../olumiCore/team/api'
import {resetWrites} from '../../olumiCore/team/writes'
import {useViewStore} from '../../olumiView/store'
import {useMe} from '../../olumiCore/me'
import type {View} from '../../olumiView/client'
const original=JSON.parse(readFileSync('src/olumiView/fixtures/real/european-22cards.view3.json','utf8')) as View
const v={...original,proposal:null,chat:[],version:{...original.version,n:1},model:{...original.model!,edit_base:41}} as View
const card=v.model!.cards.find(c=>c.family==='quantity'&&c.figure?.edit)!
afterEach(()=>{cleanup();setTeamFetch(null);setPagePerson(null);resetWrites();useViewStore.setState({uuid:null,sid:null,view:null,status:'none',error:null});useMe.setState({me:null,status:'none'})})
describe('PL e082 active edit survives an unrelated newer View',()=>{
 it('keeps the typed figure and captured base until the person submits or cancels',()=>{
 useViewStore.setState({uuid:'00000000-0000-4000-8000-0123456789ab',sid:'s_0123456789ab',view:v,status:'ready',error:null,at:null,stale:false})
 useMe.setState({me:{id:v.you_id!,name:v.you},status:'ready'})
 const props={detail:card.id,editing:true,closeDetail:()=>{},flash:()=>{}}
 const r=render(<Panel v={v} {...props}/>);const input=screen.getByTestId('next-edit-field');fireEvent.change(input,{target:{value:'1495000'}})
 expect(input).toHaveValue('1495000')
 const newer={...v,version:{...v.version!,n:2},model:{...v.model!,edit_base:42}} as View
 act(()=>useViewStore.setState({view:newer}));r.rerender(<Panel v={newer} {...props}/>)
 expect(screen.getByTestId('next-edit-field'),'Unrelated version refresh must not erase an unsaved human correction').toHaveValue('1495000')
 })
 it('a save after the refresh carries the base the editor OPENED on, never the newer one', async ()=>{
  useViewStore.setState({uuid:'00000000-0000-4000-8000-0123456789ab',sid:'s_0123456789ab',view:v,status:'ready',error:null,at:null,stale:false})
  useMe.setState({me:{id:v.you_id!,name:v.you},status:'ready'}); setPagePerson(v.you_id!)
  const newer={...v,version:{...v.version!,n:2},model:{...v.model!,edit_base:42}} as View
  const sent:{url:string;body:unknown}[]=[]
  setTeamFetch((async(url:string,init?:RequestInit)=>{
   const method=init?.method??'GET'
   if(url==='/api/me')return new Response(JSON.stringify({me:{id:v.you_id}}),{status:200})
   if(method==='POST'){sent.push({url,body:JSON.parse(String(init!.body))});return new Response(JSON.stringify({error:'this figure was edited on a different version'}),{status:409})}
   return new Response(JSON.stringify(newer),{status:200})
  }) as unknown as typeof fetch)
  const props={detail:card.id,editing:true,closeDetail:()=>{},flash:()=>{}}
  const r=render(<Panel v={v} {...props}/>);fireEvent.change(screen.getByTestId('next-edit-field'),{target:{value:'1495000'}})
  act(()=>useViewStore.setState({view:newer}));r.rerender(<Panel v={newer} {...props}/>)
  await act(async()=>{fireEvent.click(screen.getByTestId('next-edit-save'))})
  await act(async()=>{await new Promise((res)=>setTimeout(res,0))})
  expect(sent.map((x)=>(x.body as {base:number}).base),'the base captured when the editor opened').toEqual([41])
  // Core refused the stale base in its own words; the person's typing is still there.
  expect(await screen.findByTestId('next-error')).toHaveTextContent('this figure was edited on a different version')
  expect(screen.getByTestId('next-edit-field')).toHaveValue('1495000')
 })
})
