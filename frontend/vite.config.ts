import type { ClientRequest, IncomingMessage } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

function forwardPublicOriginHeaders(proxy: { on: (ev: 'proxyReq', fn: (a: unknown, b: IncomingMessage) => void) => void }) {
  proxy.on('proxyReq', (proxyReq, req) => {
    const out = proxyReq as ClientRequest
    const incoming = req as IncomingMessage
    const host = incoming.headers.host
    if (host) out.setHeader('X-Forwarded-Host', host)
    const raw = incoming.headers['x-forwarded-proto']
    const fromHeader =
      typeof raw === 'string'
        ? raw.split(',')[0].trim()
        : Array.isArray(raw)
          ? raw[0]?.split(',')[0].trim()
          : undefined
    const proto =
      fromHeader || ((incoming.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http')
    out.setHeader('X-Forwarded-Proto', proto)
  })
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['bradley-precaudal-snuffly.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure(proxy) {
          forwardPublicOriginHeaders(proxy)
        },
      },
      '/auth': {
        target: apiTarget,
        changeOrigin: true,
        configure(proxy) {
          forwardPublicOriginHeaders(proxy)
        },
      },
    },
  },
})
