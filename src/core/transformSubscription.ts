import { AppError } from "./appError.ts";
import type { TransformErrorCode, TransformInput, TransformResult } from "./coreTypes.ts";
import * as sandboxProcessor from "./runSandboxProcessor.ts";
import * as yamlCodec from "./yamlCodec.ts";

const PROCESSOR_SOURCE_ID = "processor.js";

function normalizeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return {
      message: cause.message,
      name: cause.name,
    };
  }

  return cause;
}

function createFailure(
  code: TransformErrorCode,
  error: unknown,
): TransformResult {
  if (error instanceof AppError) {
    const failure: TransformResult = {
      ok: false,
      error: {
        code,
        message: error.message,
      },
    };

    if (error.cause !== undefined) {
      failure.error.cause = normalizeCause(error.cause);
    }

    return failure;
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        cause: normalizeCause(error),
        code,
        message: error.message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code,
      message: "Unexpected core error",
    },
  };
}

function getSandboxFailureCode(error: unknown): TransformErrorCode {
  if (
    error instanceof AppError &&
    (error.code === "processorLoad" || error.code === "processorRun")
  ) {
    return "script";
  }

  return "core";
}

export async function transformSubscription(
  input: TransformInput,
): Promise<TransformResult> {
  let config;

  try {
    config = yamlCodec.parseConfig(input.subscriptionText);
  } catch (error) {
    return createFailure("input", error);
  }

  let nextConfig;

  try {
    nextConfig = await sandboxProcessor.runSandboxProcessor(
      config,
      input.processorSource,
      PROCESSOR_SOURCE_ID,
    );
  } catch (error) {
    return createFailure(getSandboxFailureCode(error), error);
  }

  try {
    return {
      ok: true,
      output: yamlCodec.dumpConfig(nextConfig),
    };
  } catch (error) {
    return createFailure("core", error);
  }
}
