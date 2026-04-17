import { AppError, EXIT_CODES } from "#core";

import type { WorkerRequestInput } from "./workerTypes.ts";

function createRequestError(message: string): AppError {
  return new AppError({
    code: "usage",
    exitCode: EXIT_CODES.usage,
    message,
  });
}

function parseRemoteUrl(value: string | null, parameterName: string): string {
  if (!value) {
    throw createRequestError(
      `Missing required query parameter: ${parameterName}`,
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw createRequestError(
      `Query parameter must be a valid URL: ${parameterName}`,
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw createRequestError(
      `Query parameter must use http or https: ${parameterName}`,
    );
  }

  return parsedUrl.toString();
}

export function parseRequest(request: Request): WorkerRequestInput {
  const requestUrl = new URL(request.url);

  return {
    processorUrl: parseRemoteUrl(
      requestUrl.searchParams.get("script"),
      "script",
    ),
    subscriptionUrl: parseRemoteUrl(requestUrl.searchParams.get("url"), "url"),
  };
}
