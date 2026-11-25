import {
  getQuickJS,
  shouldInterruptAfterDeadline,
  type QuickJSWASMModule,
} from "quickjs-emscripten";

const quickJsModulePromise = getQuickJS();

export async function getQuickJs(): Promise<QuickJSWASMModule> {
  return await quickJsModulePromise;
}

export { shouldInterruptAfterDeadline };
