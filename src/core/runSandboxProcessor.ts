import {
  isFail,
  type QuickJSContext,
  type QuickJSHandle,
} from "quickjs-emscripten-core";

import type { ClashConfig } from "../processorTypes/clashTypes.ts";
import { AppError, EXIT_CODES } from "./appError.ts";
import { getQuickJs, shouldInterruptAfterDeadline } from "./getQuickJs.ts";

const PROCESSOR_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const PROCESSOR_MAX_STACK_SIZE_BYTES = 1024 * 1024;
const PROCESSOR_TIMEOUT_MS = 1000;

function isConfigObject(value: unknown): value is ClashConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatSandboxError(errorValue: unknown): string {
  if (errorValue instanceof Error) {
    return errorValue.message;
  }

  if (
    typeof errorValue === "object" &&
    errorValue !== null &&
    "message" in errorValue &&
    typeof errorValue.message === "string"
  ) {
    return errorValue.message;
  }

  return String(errorValue);
}

function dumpHandleAndDispose(
  handle: QuickJSHandle,
  dump: (handle: QuickJSHandle) => unknown,
): unknown {
  try {
    return dump(handle);
  } finally {
    handle.dispose();
  }
}

function withHandle<T>(
  handle: QuickJSHandle,
  fn: (handle: QuickJSHandle) => T,
): T {
  try {
    return fn(handle);
  } finally {
    handle.dispose();
  }
}

function throwProcessorLoadError(message: string): never {
  throw new AppError({
    code: "processorLoad",
    exitCode: EXIT_CODES.processorLoad,
    message,
  });
}

function throwProcessorRunError(message: string): never {
  throw new AppError({
    code: "processorRun",
    exitCode: EXIT_CODES.processorRun,
    message,
  });
}

function unwrapEvalHandle(
  context: QuickJSContext,
  code: string,
  filename: string,
  messagePrefix: string,
): QuickJSHandle {
  const result = context.evalCode(code, filename, {
    type: "module",
  });

  if (isFail(result)) {
    const errorValue = dumpHandleAndDispose(result.error, (handle) =>
      context.dump(handle),
    );

    throwProcessorLoadError(
      `${messagePrefix}: ${formatSandboxError(errorValue)}`,
    );
  }

  return result.value;
}

function unwrapGlobalEvalHandle(
  context: QuickJSContext,
  code: string,
  filename: string,
  messagePrefix: string,
): QuickJSHandle {
  const result = context.evalCode(code, filename);

  if (isFail(result)) {
    const errorValue = dumpHandleAndDispose(result.error, (handle) =>
      context.dump(handle),
    );

    throwProcessorRunError(
      `${messagePrefix}: ${formatSandboxError(errorValue)}`,
    );
  }

  return result.value;
}

function getProcessorFunction(
  context: QuickJSContext,
  processorSource: string,
  processorFilename: string,
): QuickJSHandle {
  return withHandle(
    unwrapEvalHandle(
      context,
      processorSource,
      processorFilename,
      "Failed to evaluate processor script",
    ),
    (exportsHandle) => {
      const defaultExportHandle = context.getProp(exportsHandle, "default");

      if (context.typeof(defaultExportHandle) !== "function") {
        defaultExportHandle.dispose();
        throwProcessorLoadError("Processor must export a default function");
      }

      return defaultExportHandle;
    },
  );
}

function createConfigHandle(
  context: QuickJSContext,
  config: ClashConfig,
  processorFilename: string,
): QuickJSHandle {
  return unwrapGlobalEvalHandle(
    context,
    `(${JSON.stringify(config)})`,
    `${processorFilename}:input`,
    "Failed to prepare processor input",
  );
}

function callProcessor(
  context: QuickJSContext,
  processorHandle: QuickJSHandle,
  configHandle: QuickJSHandle,
): QuickJSHandle {
  const result = context.callFunction(
    processorHandle,
    context.undefined,
    configHandle,
  );

  if (isFail(result)) {
    const errorValue = dumpHandleAndDispose(result.error, (handle) =>
      context.dump(handle),
    );

    throwProcessorRunError(
      `Processor execution failed: ${formatSandboxError(errorValue)}`,
    );
  }

  return result.value;
}

function dumpNextConfig(
  context: QuickJSContext,
  resultHandle: QuickJSHandle,
): ClashConfig {
  return withHandle(resultHandle, (handle) => {
    const nextConfig = context.dump(handle);

    if (!isConfigObject(nextConfig)) {
      throwProcessorRunError("Processor must return a YAML object root");
    }

    return nextConfig;
  });
}

export async function runSandboxProcessor(
  config: ClashConfig,
  processorSource: string,
  processorFilename = "processor.js",
): Promise<ClashConfig> {
  const quickJs = await getQuickJs();
  const runtime = quickJs.newRuntime();
  const context = runtime.newContext();

  runtime.setMemoryLimit(PROCESSOR_MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(PROCESSOR_MAX_STACK_SIZE_BYTES);
  runtime.setInterruptHandler(
    shouldInterruptAfterDeadline(Date.now() + PROCESSOR_TIMEOUT_MS),
  );

  try {
    return withHandle(
      getProcessorFunction(context, processorSource, processorFilename),
      (processorHandle) =>
        withHandle(
          createConfigHandle(context, config, processorFilename),
          (configHandle) =>
            dumpNextConfig(
              context,
              callProcessor(context, processorHandle, configHandle),
            ),
        ),
    );
  } finally {
    context.dispose();
    runtime.dispose();
  }
}
