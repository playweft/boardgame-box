import { copyFile, access, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, loadEnv } from 'vite';
import { nestStaticSite, normalizeBasePath } from './vite/base-path.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const gamesRoot = join(root, 'src', 'games');
const games = [];
for (const entry of await readdir(gamesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    await access(join(gamesRoot, entry.name, 'vite.config.js'));
    games.push(entry.name);
  } catch {
    continue;
  }
}

await build({ configFile: join(root, 'vite.config.js') });
for (const game of games) {
  await build({ configFile: join(gamesRoot, game, 'vite.config.js') });
}

const base = normalizeBasePath(process.env.BASE_PATH ?? loadEnv('production', root, 'BASE_PATH').BASE_PATH);
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
