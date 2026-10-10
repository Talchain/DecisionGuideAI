import { describe, it, expect, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from '@playwright/test'
import { FactorNode } from '../FactorNode'
import { FactorObservablePanel } from '../../ui/inspector-v2/panels/FactorObservablePanel'
import { confirmOptimisticFactorEdit, type OptimisticFactorEdit } from '../../conversation/optimisticFactorEdit'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { applyDraftResult, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import { getObservedState } from '../../utils/observedStateHelpers'
import type { CEEDraftResponse } from '../../../adapters/cee/types'

vi.mock('../../../lib/supabase', async () => {
  const { createClient } = await import('../../../stubs/supabase-stub.mjs')
  return { supabase: createClient(), isSupabaseAvailable: () => false,
    getSessionIdentity: async () => ({ userId: null, guestId: 'offline-r3' }), getUserId: async () => null }
})

let conversationContext: { sendSystemEvent: ReturnType<typeof vi.fn> } | null = null
vi.mock('../../conversation/ConversationContext', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  useOptionalConversationContext: () => conversationContext,
}))

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: () => ({
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
  achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
  predictedOutcome: null, valueOfInformation: null, voiRank: null,
}) }))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: () => [] }))
vi.mock('../shared/NodePopover', () => ({ NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

// Original RUN14 final projected factor bytes: no sharpened value or new provenance.
const TAPROOM = {
  id: 'taproom_sales_share', kind: 'factor', label: 'Taproom sales share', category: 'observable',
  observed_state: { value: 0.7, unit: '%', source: 'brief_extraction', raw_value: 70, cap: 100,
    extractionType: 'explicit', uncertainty_drivers: ['about seventy per cent'], declared_scale: 'unit_interval' },
  display_value: 'about seventy per cent', provenance: 'from_brief',
  source_quote: 'We brew 6,500 litres a month and sell about seventy per cent of it through our own taproom; the rest goes to local pubs.',
}
const PUB = {
  id: 'pub_sales_share', kind: 'factor', label: 'Pub sales share', category: 'observable',
  observed_state: { value: 0.3, unit: '%', source: 'cee_inference', user_material_unverified: true,
    raw_value: 30, cap: 100, extractionType: 'inferred', declared_scale: 'unit_interval' },
  provenance: 'unverified_brief',
}
const graph = { nodes: [TAPROOM, PUB], edges: [] }
const props = { type: 'factor', selected: false, isConnectable: true, positionAbsoluteX: 0,
  positionAbsoluteY: 0, dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true }
function card(node: typeof TAPROOM | typeof PUB, mode: 'standard' | 'expert') {
  useGuidanceStore.setState({ _sendMessage: vi.fn() })
  const n = mapDraftNodeToCanvas(node)
  useCanvasStore.setState({ viewMode: mode, nodes: [n], edges: [] })
  return render(<ReactFlowProvider><FactorNode {...props} id={n.id} data={n.data} /></ReactFlowProvider>).container
}
const allNames = (c: HTMLElement) => [...c.querySelectorAll('[aria-label]')].map(n => n.getAttribute('aria-label') ?? '').join('\n')
const noOlumiEstimate = (c: HTMLElement) => {
  expect(c.querySelector('[data-testid="estimate-marker"]')).toBeNull()
  expect(c.textContent + allNames(c)).not.toMatch(/Olumi(?:’s|'s)? (?:estimate|placeholder)|Olumi estimated/i)
}

describe('R3 native approximation and withheld authorship on the actual factor card', () => {
  it.each(['standard', 'expert'] as const)('about-70 in %s keeps the receipt and verified human mark', mode => {
    const c = card(TAPROOM, mode)
    expect(factorDisplayText(mapDraftNodeToCanvas(TAPROOM).data)).toBe('about seventy per cent')
    expect(c.textContent).toContain('about seventy per cent')
    expect(c.querySelector(`[data-testid="factor-value-source-${TAPROOM.id}"]`)).toHaveAttribute('data-value-source', 'brief')
    noOlumiEstimate(c)
  })
  it.each(['standard', 'expert'] as const)('pub 30%% in %s is Not confirmed, with the existing ask', mode => {
    const c = card(PUB, mode)
    expect(c.textContent).toContain('30%')
    expect(allNames(c)).toContain('Not confirmed from your brief')
    expect(allNames(c)).toContain('What’s the evidence?')
    noOlumiEstimate(c)
  })
  it('the native unverified flag beats contradictory inferred AI display wording', () => {
    const c = card({ ...PUB, provenance: 'ai_inferred' }, 'expert')
    expect(mapDraftNodeToCanvas({ ...PUB, provenance: 'ai_inferred' }).data.provenance).toBe('unverified_brief')
    expect(allNames(c)).toContain('Not confirmed from your brief')
    noOlumiEstimate(c)
  })
  it.each(['standard', 'expert'] as const)('native word-valued explicit receipt: supported 70 → 80 commit and SAME graph reload in %s', mode => {
    cleanup()
    applyDraftResult({ schema: 'cee_draft_graph.v3', ...graph } as unknown as CEEDraftResponse, { skipHistory: true })
    const before = useCanvasStore.getState().nodes.find(n => n.id === TAPROOM.id)!.data
    expect(getObservedState(before).extractionType).toBe('explicit')
    expect(factorDisplayText(before)).toBe('about seventy per cent')
    const sendSystemEvent = vi.fn().mockResolvedValue('SENT')
    conversationContext = { sendSystemEvent }
    try {
      const editor = render(<FactorObservablePanel nodeId={TAPROOM.id} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
      fireEvent.click(editor.getByTestId('observable-value-display'))
      const input = editor.getByTestId('observable-value-input')
      expect(input).toHaveValue(70)
      fireEvent.change(input, { target: { value: '80' } })
      fireEvent.blur(input)
      expect(sendSystemEvent).toHaveBeenCalledTimes(1)
      expect(sendSystemEvent.mock.calls[0][0]).toMatchObject({ payload: { value: 0.8, raw_value: 80 } })
      const undo = sendSystemEvent.mock.calls[0][1].optimisticFactorEdit as OptimisticFactorEdit
      expect(undo.nodeId).toBe(TAPROOM.id)
      const pending = useCanvasStore.getState().nodes.find(n => n.id === TAPROOM.id)!
      expect(pending.data.observedState).toMatchObject({ source: 'brief_extraction', extractionType: null, value: 0.8, raw_value: 80 })
      expect(factorDisplayText(pending.data)).toBe('80%')
      useCanvasStore.setState({ viewMode: mode })
      const pendingCard = render(<ReactFlowProvider><FactorNode {...props} id={pending.id} data={pending.data} /></ReactFlowProvider>)
      expect(pendingCard.container.textContent).toContain('80%')
      expect(pendingCard.container.textContent).not.toContain('about seventy per cent')
      pendingCard.unmount()
      // Offline applied-receipt seam; no server acceptance is claimed by this test.
      act(() => { expect(confirmOptimisticFactorEdit(undo)).toBe('stamped') })
      editor.unmount()
      for (const phase of ['committed', 'reloaded']) {
        if (phase === 'reloaded') {
          const saved = useCanvasStore.getState().exportCanvas()
          expect(useCanvasStore.getState().importCanvas(saved)).toBe(true)
        }
        const edited = useCanvasStore.getState().nodes.find(n => n.id === TAPROOM.id)!
        expect(edited.data.observedState).toMatchObject({ value: 0.8, raw_value: 80, unit: '%', cap: 100,
          source: 'user_override', extractionType: null, declared_scale: 'unit_interval' })
        expect(edited.data.display_value).toBeUndefined()
        expect(getObservedState(edited.data).display_value).toBeUndefined()
        expect(edited.data.source_quote).toBe(before.source_quote)
        expect(edited.data.provenance).toBe(before.provenance)
        expect(getObservedState(edited.data).uncertainty_drivers).toStrictEqual(getObservedState(before).uncertainty_drivers)
        expect(factorDisplayText(edited.data)).toBe('80%')
        useCanvasStore.setState({ viewMode: mode })
        const c = render(<ReactFlowProvider><FactorNode {...props} id={edited.id} data={edited.data} /></ReactFlowProvider>)
        expect(c.container.textContent).toContain('80%')
        expect(c.container.textContent + allNames(c.container)).not.toContain('about seventy per cent')
        expect(c.container.querySelector(`[data-testid="factor-value-source-${TAPROOM.id}"]`)).toHaveAttribute('data-value-source', 'you')
        noOlumiEstimate(c.container)
        c.unmount()
      }
    } finally { conversationContext = null }
  })
  it.each(['standard', 'expert'] as const)('an unchanged explicit about-70 receipt survives SAME graph reload in %s', mode => {
    cleanup()
    const unchanged = { ...TAPROOM, display_value: 'about 70%', observed_state: {
      ...TAPROOM.observed_state, uncertainty_drivers: ['about 70%'],
    } }
    applyDraftResult({ schema: 'cee_draft_graph.v3', nodes: [unchanged, PUB], edges: [] } as unknown as CEEDraftResponse, { skipHistory: true })
    expect(useCanvasStore.getState().importCanvas(useCanvasStore.getState().exportCanvas())).toBe(true)
    const n = useCanvasStore.getState().nodes.find(n => n.id === TAPROOM.id)!
    useCanvasStore.setState({ viewMode: mode })
    const c = render(<ReactFlowProvider><FactorNode {...props} id={n.id} data={n.data} /></ReactFlowProvider>)
    expect(c.container.textContent).toContain('about 70%')
    expect(getObservedState(n.data).extractionType).toBe('explicit')
    expect(c.container.querySelector(`[data-testid="factor-value-source-${TAPROOM.id}"]`)).toHaveAttribute('data-value-source', 'brief')
    c.unmount()
  })
  it('a stale user edit keeps the new figure instead of the old about receipt', () => {
    const data = mapDraftNodeToCanvas(TAPROOM).data
    for (const source of ['user_override', 'brief_extraction']) {
      const edited = { ...data, observedState: { ...data.observedState, source, value: 0.8, raw_value: 80, extractionType: null } }
      expect(factorDisplayText(edited)).toBe('80%')
    }
    expect(factorDisplayText({ ...data, pending_user_value: 0.8,
      observedState: { ...data.observedState, value: 0.8, raw_value: 80 } })).toBe('80%')
  })
  it('a contradicted numeric about string keeps the existing stale-value guard', () => {
    const data = mapDraftNodeToCanvas(TAPROOM).data
    expect(factorDisplayText({ ...data, display_value: 'about 70%', observedState: {
      ...data.observedState, value: 0.8, raw_value: 80, uncertainty_drivers: ['about 70%'],
    } })).toBe('80%')
  })
  it('the existing uncertainty driver alone preserves the stated approximation', () => {
    expect(factorDisplayText(mapDraftNodeToCanvas({ ...TAPROOM, display_value: '70%' }).data)).toBe('about seventy per cent')
  })
  it('a true AI estimate still reads as Olumi’s estimate', () => {
    const c = card({ ...PUB, provenance: 'ai_inferred', observed_state: {
      ...PUB.observed_state, user_material_unverified: undefined,
    } } as unknown as typeof PUB, 'standard')
    expect(c.querySelector('[data-testid="estimate-marker"]')).not.toBeNull()
    expect(allNames(c)).toContain('Olumi')
  })
  it('a verified human value keeps its own figure and yours/brief authorship', () => {
    const c = card({ ...TAPROOM, display_value: '70%', observed_state: {
      ...TAPROOM.observed_state, uncertainty_drivers: [],
    } }, 'expert')
    expect(c.querySelector(`[data-testid="factor-value-source-${TAPROOM.id}"]`)).toHaveAttribute('data-value-source', 'brief')
    noOlumiEstimate(c)
  })
  it('applyDraftResult → export → import of the SAME graph retains raw, about and unverified bytes', () => {
    applyDraftResult({ schema: 'cee_draft_graph.v3', ...graph } as unknown as CEEDraftResponse, { skipHistory: true })
    const before = useCanvasStore.getState().nodes.map(n => ({ id: n.id, data: n.data }))
    const saved = useCanvasStore.getState().exportCanvas()
    expect(useCanvasStore.getState().importCanvas(saved)).toBe(true)
    for (const previous of before) {
      const n = useCanvasStore.getState().nodes.find(n => n.id === previous.id)!
      expect(n.data.observedState).toStrictEqual(previous.data.observedState)
      expect(n.data.display_value).toBe(previous.data.display_value)
      expect(n.data.provenance).toBe(previous.data.provenance)
    }
  })

  it.runIf(Boolean(process.env.R3_UI_WITNESS_PATH))('offline real browser: banked native graph → supported 70 → 80 edit → SAME graph reload in both views', async () => {
    cleanup()
    mkdirSync(resolve('run17-out'), { recursive: true })
    const dir = mkdtempSync(resolve('run17-out/native-'))
    const root = process.cwd()
    const witness = process.env.R3_UI_WITNESS_PATH
    const original = witness ? JSON.parse(readFileSync(witness, 'utf8')) : graph
    writeFileSync(join(dir, 'input.json'), JSON.stringify(original, null, 2))
    const entry = `
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
      import {ReactFlow,ReactFlowProvider} from '@xyflow/react';
      import {FactorNode} from '${root}/src/canvas/nodes/FactorNode.tsx';
      import {FactorObservablePanel} from '${root}/src/canvas/ui/inspector-v2/panels/FactorObservablePanel.tsx';
      import {useCanvasStore} from '${root}/src/canvas/store.ts';
      import {applyDraftResult} from '${root}/src/canvas/utils/applyDraftResult.ts';
      import {useGuidanceStore} from '${root}/src/canvas/stores/guidanceStore.ts';
      useGuidanceStore.setState({_sendMessage:()=>{}});
      import '@xyflow/react/dist/style.css';
      const root=createRoot(document.getElementById('root'));
      window.loadR3=(g)=>applyDraftResult({schema:'cee_draft_graph.v3',...g},{skipHistory:true});
      window.editR3=()=>root.render(<FactorObservablePanel nodeId="taproom_sales_share" techMode={false} onClose={()=>{}} onNavigate={()=>{}} />);
      window.saveR3=()=>useCanvasStore.getState().exportCanvas();
      window.reloadR3=(saved)=>useCanvasStore.getState().importCanvas(saved);
      window.renderR3=(mode)=>{useCanvasStore.setState({viewMode:mode});
        const nodes=useCanvasStore.getState().nodes.filter(n=>['taproom_sales_share','pub_sales_share'].includes(n.id))
          .map((n,i)=>({...n,position:{x:40+i*420,y:40}}));
        flushSync(()=>root.render(<ReactFlowProvider><ReactFlow nodes={nodes} edges={[]} nodeTypes={{factor:FactorNode}} maxZoom={1} fitViewOptions={{padding:0.15}} fitView /></ReactFlowProvider>));
        return nodes.map(n=>({id:n.id,data:n.data}));};
    `
    const entryPath = join(dir, 'entry.tsx')
    writeFileSync(entryPath, entry)
    const buildOptions = { entryPoints: [entryPath], bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
      outfile: join(dir, 'ui.js'), alias: { '@': resolve('src'), '@supabase/supabase-js': resolve('src/stubs/supabase-stub.mjs') },
      define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production', VITE_AUTH_MODE: 'guest',
        VITE_SUPABASE_URL: 'http://localhost/dummy', VITE_SUPABASE_ANON_KEY: 'offline-dummy' }) },
      loader: { '.svg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl', '.woff2': 'dataurl' },
    }
    const buildPath = join(dir, 'build.cjs')
    writeFileSync(buildPath, `const {createRequire}=require('node:module');
      const {realpathSync}=require('node:fs');
      const req=createRequire(realpathSync(${JSON.stringify(resolve('node_modules/vite/package.json'))}));
      req('esbuild').buildSync(${JSON.stringify(buildOptions)});
      const fs=require('node:fs');
      const rootReq=createRequire(${JSON.stringify(resolve('package.json'))});
      const css=fs.readFileSync(${JSON.stringify(resolve('src/index.css'))},'utf8')
        .replace(/^@import url\\([^\\n]+\\);/m,'')
        .replace("@import './styles/brand.css';",fs.readFileSync(${JSON.stringify(resolve('src/styles/brand.css'))},'utf8'));
      rootReq('postcss')([rootReq('tailwindcss')(${JSON.stringify(resolve('tailwind.config.js'))}),rootReq('autoprefixer')()])
        .process(css,{from:${JSON.stringify(resolve('src/index.css'))}})
        .then(r=>fs.writeFileSync(${JSON.stringify(join(dir,'app.css'))},r.css));`)
    execFileSync(process.execPath, [buildPath], { cwd: root, stdio: 'pipe' })
    writeFileSync(join(dir, 'index.html'), '<html><head></head><body><div id="root" style="width:1100px;height:750px"></div></body></html>')
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
      const external: string[] = []
      await page.route('**/*', route => {
        if (route.request().url().startsWith('file:')) return route.continue()
        external.push(route.request().url()); return route.abort()
      })
      await page.goto('file://' + join(dir, 'index.html'))
      await page.addStyleTag({ path: join(dir, 'ui.css') })
      await page.addStyleTag({ path: join(dir, 'app.css') })
      await page.addScriptTag({ path: join(dir, 'ui.js') })
      await page.evaluate(g => (window as any).loadR3(g), original)
      for (const phase of ['first', 'reload', 'edited', 'edited-reload']) {
        if (phase === 'edited') {
          await page.evaluate(() => (window as any).editR3())
          await page.getByTestId('observable-value-display').click()
          const input = page.getByTestId('observable-value-input')
          expect(await input.inputValue()).toBe('70')
          await input.fill('80')
          await input.press('Enter')
        }
        for (const mode of ['standard', 'expert']) {
          const state = await page.evaluate(m => (window as any).renderR3(m), mode)
          const tap = page.locator('.react-flow__node[data-id="taproom_sales_share"]')
          const pub = page.locator('.react-flow__node[data-id="pub_sales_share"]')
          await tap.waitFor()
          // Wait for the new view, not an unrelated timing guess.
          await page.waitForFunction(({mode: m, edited}) => {
            const tap = document.querySelector('.react-flow__node[data-id="taproom_sales_share"]')
            return tap && (edited
              ? tap.textContent?.includes('80%') && !tap.textContent?.includes('about seventy per cent')
              : tap.textContent?.includes('Uncertainty drivers:') === (m === 'expert'))
          }, {mode, edited: phase.startsWith('edited')})
          const texts = { tap: await tap.innerText(), pub: await pub.innerText(),
            tapNames: await tap.locator('[aria-label]').evaluateAll(ns => ns.map(n => n.getAttribute('aria-label'))),
            pubNames: await pub.locator('[aria-label]').evaluateAll(ns => ns.map(n => n.getAttribute('aria-label'))) }
          writeFileSync(join(dir, phase + '-' + mode + '.json'), JSON.stringify({ state, texts }, null, 2))
          await page.screenshot({ path: join(dir, phase + '-' + mode + '.png') })
          await pub.locator('[data-testid="factor-value-source-pub_sales_share"]').hover()
          await page.getByRole('tooltip').filter({ hasText: 'Not confirmed from your brief' }).first().waitFor()
          await page.screenshot({ path: join(dir, phase + '-' + mode + '-pub-label.png') })
          await page.mouse.move(0, 0)
          if (phase.startsWith('edited')) {
            expect(texts.tap).toContain('80%')
            expect(texts.tap + texts.tapNames.join('\n')).not.toContain('about seventy per cent')
            expect(await tap.locator('[data-testid="factor-value-source-taproom_sales_share"]').getAttribute('data-value-source')).toBe('you')
          } else {
            expect(texts.tap).toContain('about seventy per cent')
            expect(texts.tapNames.join('\n')).toContain('From your brief')
          }
          expect(texts.pubNames.join('\n')).toContain('Not confirmed from your brief')
          expect(texts.pubNames.join('\n')).toContain('What’s the evidence?')
          expect(texts.pub + texts.pubNames.join('\n')).not.toMatch(/Olumi(?:’s|'s)? estimate|Olumi estimated/i)
          for (const id of ['taproom_sales_share', 'pub_sales_share']) {
            const input = original.nodes.find((n: { id: string }) => n.id === id)
            const data = state.find((n: { id: string }) => n.id === id).data
            if (id === 'taproom_sales_share' && phase.startsWith('edited')) {
              expect(data.observedState).toStrictEqual({ ...input.observed_state,
                value: 0.8, raw_value: 80, source: 'user_override', extractionType: null,
                ...(phase === 'edited' ? { display_value: undefined } : {}) })
              expect(data.display_value).toBeUndefined()
            } else {
              expect(data.observedState).toStrictEqual(input.observed_state)
              expect(data.display_value).toBe(input.display_value)
            }
            expect(data.provenance).toBe(input.provenance)
          }
        }
        if (phase === 'first' || phase === 'edited') {
          const saved = await page.evaluate(() => (window as any).saveR3())
          writeFileSync(join(dir, phase + '-saved.json'), saved)
          expect(await page.evaluate(s => (window as any).reloadR3(s), saved)).toBe(true)
        }
      }
      writeFileSync(join(dir, 'blocked-network.json'), JSON.stringify(external))
      expect(external).toStrictEqual([])
    } finally { await browser.close() }
  }, 60000)
})
