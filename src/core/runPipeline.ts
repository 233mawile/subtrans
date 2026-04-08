import type { RunPipelineInput, RunPipelineResult } from "./coreTypes.ts";
import { resolveTextInput } from "./resolveTextInput.ts";
import { runSandboxProcessor } from "./runSandboxProcessor.ts";
import { dumpConfig, parseConfig } from "./yamlCodec.ts";

export async function runPipeline(
  input: RunPipelineInput,
): Promise<RunPipelineResult> {
  const [subscriptionText, processorSource] = await Promise.all([
    resolveTextInput(input.subscription, input.fetchImpl),
    resolveTextInput(input.processor, input.fetchImpl),
  ]);
  const config = parseConfig(subscriptionText);
  const nextConfig = await runSandboxProcessor(
    config,
    processorSource,
    input.processor.type === "source"
      ? input.processor.filename
      : input.processor.url,
  );

  return {
    outputYaml: dumpConfig(nextConfig),
  };
}
