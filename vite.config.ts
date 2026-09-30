import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  logLevel: process.env.VITEST ? 'error' : 'info',
  plugins: [react(), wasm(), nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util', 'events', 'process'] })],
  resolve: { alias: { 'isomorphic-ws': fileURLToPath(new URL('./src/shims/isomorphic-ws.ts', import.meta.url)) } },
  build: { target: 'esnext', chunkSizeWarningLimit: 1600 },
  optimizeDeps: { exclude: ['@midnight-ntwrk/ledger-v8', '@midnight-ntwrk/onchain-runtime-v3'] },
  server: { port: 5173, strictPort: true },
  test: { environment: 'jsdom', setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 20000 },
});
