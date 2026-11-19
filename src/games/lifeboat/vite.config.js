import { join } from "node:path";
import { createGameConfig } from "#vite-config";

const root = import.meta.dirname;
const config = createGameConfig(root);

export default {
  ...config,
  build: {
    ...config.build,
    rolldownOptions: { input: [join(root, "index.html"), join(root, "help.html")] },
  },
};
