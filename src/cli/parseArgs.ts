import { AppError, EXIT_CODES } from "#core";

export interface CliArgs {
  helpRequested: boolean;
  outputPath?: string;
  processorPath: string;
  subscriptionUrl: string;
}

const HELP_TEXT = [
  "Usage:",
  "  node . --url <subscription-url> --script <processor-path> [--out <output-path>]",
  "",
  "Options:",
  "  --url       Remote Clash subscription URL",
  "  --script    Local processor module path",
  "  --out       Optional output file path",
  "  --help      Show this help message",
].join("\n");

function createUsageError(message: string): AppError {
  return new AppError({
    code: "usage",
    exitCode: EXIT_CODES.usage,
    message,
  });
}

function readOptionValue(
  argv: string[],
  index: number,
  option: string,
): string {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw createUsageError(`Missing value for argument: ${option}`);
  }

  return value;
}

export function formatHelpText(): string {
  return HELP_TEXT;
}

export function parseArgs(argv: string[]): CliArgs {
  let subscriptionUrl = "";
  let processorPath = "";
  let outputPath: string | undefined;
  let helpRequested = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--help":
      case "-h":
        helpRequested = true;
        break;
      case "--url":
        subscriptionUrl = readOptionValue(argv, index, argument);
        index += 1;
        break;
      case "--script":
        processorPath = readOptionValue(argv, index, argument);
        index += 1;
        break;
      case "--out":
        outputPath = readOptionValue(argv, index, argument);
        index += 1;
        break;
      default:
        throw createUsageError(`Unknown argument: ${argument}`);
    }
  }

  if (helpRequested) {
    const helpArgs: CliArgs = {
      helpRequested,
      processorPath,
      subscriptionUrl,
    };

    if (outputPath) {
      helpArgs.outputPath = outputPath;
    }

    return helpArgs;
  }

  if (!subscriptionUrl) {
    throw createUsageError("Missing required argument: --url");
  }

  if (!processorPath) {
    throw createUsageError("Missing required argument: --script");
  }

  try {
    const parsedUrl = new URL(subscriptionUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new TypeError("Unsupported protocol");
    }
  } catch {
    throw createUsageError(`Invalid subscription URL: ${subscriptionUrl}`);
  }

  const parsedArgs: CliArgs = {
    helpRequested,
    processorPath,
    subscriptionUrl,
  };

  if (outputPath) {
    parsedArgs.outputPath = outputPath;
  }

  return parsedArgs;
}
