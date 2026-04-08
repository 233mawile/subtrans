import { AppError, runPipeline, toAppError } from "#core";
import type { RunPipelineInput } from "#core";
import { createSubscriptionFetch } from "./createSubscriptionFetch.ts";
import { formatHelpText, parseArgs } from "./parseArgs.ts";
import { writeOutput } from "./writeOutput.ts";

function formatCliError(error: AppError): string {
  const causeMessage =
    error.cause instanceof Error && error.cause.message !== error.message
      ? `\n${error.cause.message}`
      : "";

  return `${error.message}${causeMessage}`;
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  try {
    const args = parseArgs(argv);

    if (args.helpRequested) {
      process.stdout.write(`${formatHelpText()}\n`);
      return;
    }

    const pipelineInput: RunPipelineInput = {
      processorPath: args.processorPath,
      subscriptionUrl: args.subscriptionUrl,
    };
    const fetchImpl = createSubscriptionFetch(args.subscriptionUrl);

    if (fetchImpl) {
      pipelineInput.fetchImpl = fetchImpl;
    }

    const result = await runPipeline(pipelineInput);

    await writeOutput(result.outputYaml, args.outputPath);
  } catch (error) {
    const appError = toAppError(error);
    process.stderr.write(`${formatCliError(appError)}\n`);
    process.exitCode = appError.exitCode;
  }
}
