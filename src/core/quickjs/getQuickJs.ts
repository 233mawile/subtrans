import {
  RELEASE_SYNC,
  newQuickJSWASMModule,
  newVariant,
  shouldInterruptAfterDeadline,
  type QuickJSWASMModule,
} from "quickjs-emscripten";
import quickJsWasmModule from "./quickJsEmscriptenModule.wasm";

const quickJsModulePromise = newQuickJSWASMModule(
  newVariant(RELEASE_SYNC, {
    wasmModule: quickJsWasmModule,
  }),
);

export async function getQuickJs(): Promise<QuickJSWASMModule> {
  return await quickJsModulePromise;
}

export { shouldInterruptAfterDeadline };
