import { AppError, runPipeline, toAppError } from "#core";
import { loadTextInput } from "./loadTextInput.ts";
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

    const [subscription, processor] = await Promise.all([
      loadTextInput(args.subscriptionUrl, {
        userAgent: args.userAgent,
      }),
      loadTextInput(args.processorPath, {
        filename: args.processorPath,
        userAgent: args.userAgent,
      }),
    ]);
    const result = await runPipeline({
      processor,
      subscription,
    });

    await writeOutput(result.outputYaml, args.outputPath);
  } catch (error) {
    const appError = toAppError(error);
    process.stderr.write(`${formatCliError(appError)}\n`);
    process.exitCode = appError.exitCode;
  }
}
