import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "./quickjs/getQuickJs.ts": fileURLToPath(
        new URL("./src/core/quickjs/getQuickJsNode.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/core/**/*.test.ts"],
  },
});
