import { AppError } from "./appError.ts";
import type { TransformErrorCode, TransformInput, TransformResult } from "./coreTypes.ts";
import { runSandboxProcessor } from "./runSandboxProcessor.ts";
import * as yamlCodec from "./yamlCodec.ts";

const PROCESSOR_SOURCE_ID = "processor.js";

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
      failure.error.cause = error.cause;
    }

    return failure;
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        cause: error,
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
    nextConfig = await runSandboxProcessor(
      config,
      input.processorSource,
      PROCESSOR_SOURCE_ID,
    );
  } catch (error) {
    return createFailure("script", error);
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
