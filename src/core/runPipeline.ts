import { AppError, EXIT_CODES } from "./appError.ts";
import type { RunPipelineInput, RunPipelineResult } from "./coreTypes.ts";
import type { ClashConfig } from "../processorTypes/clashTypes.ts";
import { fetchSubscription } from "./fetchSubscription.ts";
import { loadProcessor } from "./loadProcessor.ts";
import { dumpConfig, parseConfig } from "./yamlCodec.ts";

function isConfigObject(value: unknown): value is ClashConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function runPipeline(
  input: RunPipelineInput,
): Promise<RunPipelineResult> {
  const subscriptionText = await fetchSubscription(
    input.subscriptionUrl,
    input.fetchImpl,
  );
  const config = parseConfig(subscriptionText);
  const processor = await loadProcessor(input.processorPath);

  let nextConfig: ClashConfig;

  try {
    nextConfig = await processor(config);
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "processorRun",
      exitCode: EXIT_CODES.processorRun,
      message: "Processor execution failed",
    });
  }

  if (!isConfigObject(nextConfig)) {
    throw new AppError({
      code: "processorRun",
      exitCode: EXIT_CODES.processorRun,
      message: "Processor must return a YAML object root",
    });
  }

  return {
    outputYaml: dumpConfig(nextConfig),
  };
}
