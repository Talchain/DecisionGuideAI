// The view gallery's build (DL 15:53Z, plan v3): the product's own Vite config with ONE change, the page it starts from. The product build
// (vite.config.ts, index.html) is untouched and never includes view-gallery.html, src/olumiView/gallery or a saved View file.
//   source scripts/olumi-core/env.sh && npx vite build --config vite.gallery.config.ts --outDir <a folder of its own>
import path from 'path'
import { defineConfig, mergeConfig, type ConfigEnv, type UserConfig } from 'vite'
import base from './vite.config'

export default defineConfig(async (env: ConfigEnv): Promise<UserConfig> => {
  const product: UserConfig = typeof base === 'function' ? await base(env) : await base
  return mergeConfig(product, { build: { rollupOptions: { input: { 'view-gallery': path.resolve(__dirname, 'view-gallery.html') } } } })
})
