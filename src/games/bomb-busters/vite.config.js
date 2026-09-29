import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  root,
  base: "./",
  publicDir: resolve(root, "../../../public/games/bomb-busters"),
  plugins: [preact()],
  build: {
    outDir: resolve(root, "../../../dist/bomb-busters"),
    assetsDir: "assets",
    emptyOutDir: false,
  },
});
