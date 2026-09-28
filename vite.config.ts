import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from https://drafteame.github.io/one-click-bet/
  // — assets must be prefixed with the repo name so they resolve.
  base: '/one-click-bet/',
  plugins: [react()],
  server: {
    // `host: true` binds to 0.0.0.0 so the dev server is reachable from
    // other devices on the same Wi-Fi network (e.g. iPhone testing the
    // responsive layout). Vite prints both the localhost URL and the LAN
    // URL on start.
    host: true,
    port: 5174,
    strictPort: true,
  },
});
