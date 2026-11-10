import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  // pnpm hoists motion's own react copy; without dedupe the app ends up with two Reacts
  resolve: { tsconfigPaths: true, dedupe: ['react', 'react-dom'] },
  // a leading dot matches the domain and its subdomains, so any tunnel this machine
  // opens is let through; dev only, and the host check still blocks everything else
  server: { allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app'] },
  plugins: [devtools(), nitro(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
