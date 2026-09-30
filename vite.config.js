import { readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { build, defineConfig, loadEnv } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig(({ command, mode }) => {
  const base = command === "build"
    ? normalizeBasePath(loadEnv(mode, root, "BASE_PATH").BASE_PATH)
    : "/";

  return {
    base,
    publicDir: command === "serve" ? "public" : false,
    server: { port: 9143 },
    plugins: [
      preact(),
      gameDevRoutes(),
      {
        name: "build-games",
        apply: "build",
        writeBundle: () => buildGames(base),
      },
    ],
  };
});

const root = import.meta.dirname;
const games = readdirSync(join(root, "src/games")).filter((game) =>
  statSync(join(root, "src/games", game, "vite.config.js"), {
    throwIfNoEntry: false,
  })?.isFile(),
);

export function createGameConfig(gameRoot) {
  const game = basename(gameRoot);
  return {
    root: gameRoot,
    base: "./",
    publicDir: join(root, "public", game),
    plugins: [preact()],
    build: { outDir: join(root, "dist", game), emptyOutDir: false },
  };
}

function gameDevRoutes() {
  return {
    name: "game-dev-routes",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url, "http://localhost");
        const match = url.pathname.match(/^\/([^/]+)(\/.*)?$/);
        if (match && games.includes(match[1])) {
          const game = match[1];
          const file = !match[2] || match[2] === "/" ? "/index.html" : match[2];
          if (statSync(join(root, "src/games", game, file), {
            throwIfNoEntry: false,
          })?.isFile()) {
            request.url = `/src/games/${game}${file}${url.search}`;
          }
        }
        next();
      });
    },
  };
}

function normalizeBasePath(value = '') {
  const path = value.trim();
  if (!path || path === '/') return '/';
  const segments = path.replace(/^\/+|\/+$/g, '').split('/');
  if (path.startsWith('//') || segments.some(part => !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(part)) || ['_headers', '_redirects'].includes(segments[0])) {
    throw new Error('BASE_PATH must be a URL path such as /games/ (letters, numbers, dots, underscores and hyphens; no URL, query or traversal).');
  }
  return '/' + segments.join('/') + '/';
}

async function nestStaticSite(outDir, base) {
  if (base === '/') return;
  const target = join(outDir, base.slice(1));
  const staging = await mkdtemp(outDir + '-base-');
  await rename(outDir, join(staging, 'site'));
  await mkdir(dirname(target), { recursive: true });
  await rename(join(staging, 'site'), target);
  await rmdir(staging);

  const headers = join(target, '_headers');
  const source = await readFile(headers, 'utf8');
  await rename(headers, join(outDir, '_headers'));
  await writeFile(join(outDir, '_headers'), source.replace(/^\/(.*)$/gm, (_, path) => base + path));
}

async function buildGames(base) {
  for (const game of games) {
    await build({ configFile: join(root, 'src/games', game, 'vite.config.js') });
  }

  for (const game of games) {
    const manifestPath = join(root, 'dist', game, 'playweft.json');
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.id = `${base}${game}/`;
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  await copyFile(join(root, 'public', '_headers'), join(root, 'dist', '_headers'));
  await copyFile(
    join(root, 'public', 'featured-games.json'),
    join(root, 'dist', 'featured-games.json'),
  );
  await nestStaticSite(join(root, 'dist'), base);
}
