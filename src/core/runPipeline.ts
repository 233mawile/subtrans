import type { RunPipelineInput, RunPipelineResult } from "./coreTypes.ts";
import { fetchSubscription } from "./fetchSubscription.ts";
import { loadProcessorSource } from "./loadProcessorSource.ts";
import { runSandboxProcessor } from "./runSandboxProcessor.ts";
import { dumpConfig, parseConfig } from "./yamlCodec.ts";

export async function runPipeline(
  input: RunPipelineInput,
): Promise<RunPipelineResult> {
  const subscriptionText = await fetchSubscription(
    input.subscriptionUrl,
    input.fetchImpl,
  );
  const config = parseConfig(subscriptionText);
  const processorSource = await loadProcessorSource(input.processorPath);
  const nextConfig = await runSandboxProcessor(
    config,
    processorSource.source,
    processorSource.sourcePath,
  );

  return {
    outputYaml: dumpConfig(nextConfig),
  };
}
