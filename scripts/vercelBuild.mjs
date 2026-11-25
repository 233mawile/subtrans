import { build } from "esbuild";

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
});
