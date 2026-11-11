import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

import { PRODUCTION, registryOrigin } from './scripts/origin.mjs'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'

// the docs pages are MDX: frontmatter becomes an export the loader reads, headings get ids the
// contents rail links to, and code is highlighted at build time rather than in the reader's browser
const docs = mdx({
  remarkPlugins: [remarkGfm, remarkFrontmatter, [remarkMdxFrontmatter, { name: 'frontmatter' }]],
  rehypePlugins: [rehypeSlug, [rehypeShiki, { theme: 'github-dark-default' }]],
})

const config = defineConfig({
  // decided here, where Vercel's own variables are readable: the canonical address, and where this build's registry
  // is served — on a preview, the preview itself, so its Open in v0 buttons open what it built
  define: {
    'import.meta.env.VITE_SITE_URL': JSON.stringify(process.env.VITE_SITE_URL || PRODUCTION),
    'import.meta.env.VITE_REGISTRY_URL': JSON.stringify(registryOrigin()),
  },
  // pnpm hoists motion's own react copy; without dedupe the app ends up with two Reacts
  resolve: { tsconfigPaths: true, dedupe: ['react', 'react-dom'] },
  // a leading dot matches the domain and its subdomains, so any tunnel this machine
  // opens is let through; dev only, and the host check still blocks everything else
  server: { allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app'] },
  plugins: [
    devtools(),
    // the same .mdx file is imported twice — once compiled, once `?raw` for Copy as Markdown —
    // so the raw request has to reach Vite untouched
    {
      ...docs,
      enforce: 'pre',
      transform(code: string, id: string) {
        return id.includes('?raw') ? null : docs.transform.call(this, code, id)
      },
    } as Plugin,
    nitro(),
    tailwindcss(),
    tanstackStart(),
    viteReact({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
  ],
})

export default config
