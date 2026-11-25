import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const nodeQuickJs = fileURLToPath(
  new URL("../src/core/quickjs/getQuickJsVitest.ts", import.meta.url),
);

// Swap the Workers wasm-import loader for the Node one.
const useNodeQuickJs = {
  name: "use-node-quickjs",
  setup(b) {
    b.onResolve({ filter: /quickjs\/getQuickJs\.ts$/ }, () => ({
      path: nodeQuickJs,
    }));
  },
};

await build({
  entryPoints: ["src/vercel/index.ts"],
  outfile: "dist/vercel/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["quickjs-emscripten"],
  banner: {
    js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
  },
  plugins: [useNodeQuickJs],
});
