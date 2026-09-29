import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import { normalizeBasePath } from './build/vite/base-path.js';

export default defineConfig(({ command, mode }) => ({
  base: command === 'build'
    ? normalizeBasePath(loadEnv(mode, import.meta.dirname, 'BASE_PATH').BASE_PATH)
    : '/',
  publicDir: command === 'serve' ? 'public' : false,
  server: { port: 6604 },
  plugins: [
    preact(),
    {
      name: 'game-dev-routes',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          for (const game of ['avalon', 'bomb-busters']) {
            if (request.url === `/${game}/help.html`) {
              request.url = `/games/${game}/help.html`;
              break;
            }
            const publicFile = ['playweft.json', 'game.lua', 'icon.svg'].find(
              (file) =>
                request.url === `/${game}/${file}` ||
                request.url?.startsWith(`/${game}/${file}?`),
            );
            if (publicFile) {
              request.url = request.url.replace(
                `/${game}/${publicFile}`,
                `/games/${game}/${publicFile}`,
              );
              break;
            }
            if (
              request.url === `/games/${game}` ||
              request.url?.startsWith(`/games/${game}/`)
            ) {
              request.url = request.url.replace(`/games/${game}`, `/src/games/${game}`);
              break;
            }
            if (request.url === `/${game}` || request.url?.startsWith(`/${game}/`)) {
              request.url = request.url.replace(`/${game}`, `/src/games/${game}`);
              break;
            }
          }
          next();
        });
      },
    },
  ],
}));
