import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline,
  type QuickJSSyncVariant,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";

const quickJsModulePromise = import("@jitl/quickjs-wasmfile-release-sync").then(
  async (module) =>
    await newQuickJSWASMModuleFromVariant(
      module.default as unknown as QuickJSSyncVariant,
    ),
);

export async function getQuickJs(): Promise<QuickJSWASMModule> {
  return await quickJsModulePromise;
}

export { shouldInterruptAfterDeadline };
