export const EXIT_CODES = {
  network: 2,
  output: 6,
  processorLoad: 4,
  processorRun: 5,
  usage: 1,
  yaml: 3,
} as const;

export type AppErrorCode =
  | "network"
  | "output"
  | "processorLoad"
  | "processorRun"
  | "usage"
  | "yaml";

interface AppErrorOptions {
  cause?: unknown;
  code: AppErrorCode;
  exitCode: number;
  message: string;
}

export class AppError extends Error {
  readonly cause?: unknown;
  readonly code: AppErrorCode;
  readonly exitCode: number;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.exitCode = options.exitCode;
    this.cause = options.cause;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError({
      cause: error,
      code: "usage",
      exitCode: EXIT_CODES.usage,
      message: error.message,
    });
  }

  return new AppError({
    code: "usage",
    exitCode: EXIT_CODES.usage,
    message: "Unexpected error",
  });
}
