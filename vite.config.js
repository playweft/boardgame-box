import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import { normalizeBasePath } from './build/vite/base-path.js';

export default defineConfig(({ command, mode }) => ({
  base: command === 'build'
    ? normalizeBasePath(loadEnv(mode, import.meta.dirname, 'BASE_PATH').BASE_PATH)
    : '/',
  publicDir: false,
  server: { port: 6604 },
  plugins: [
    preact(),
    {
      name: 'avalon-dev-route',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === '/avalon' || request.url?.startsWith('/avalon/')) {
            request.url = request.url.replace('/avalon', '/src/games/avalon');
          }
          next();
        });
      },
    },
  ],
}));
