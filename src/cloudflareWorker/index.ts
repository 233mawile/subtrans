import { transformSubscription } from "#core";
import { AppError, EXIT_CODES, toAppError } from "../core/appError.ts";

import { parseRequest } from "./parseRequest.ts";
import type { WorkerEnv } from "./workerTypes.ts";

function getResponseStatus(error: AppError): number {
  switch (error.code) {
    case "usage":
      return 400;
    case "network":
      return 502;
    case "output":
    case "processorLoad":
    case "processorRun":
    case "yaml":
      return 500;
  }
}

function createErrorResponse(error: AppError): Response {
  return new Response(`${error.message}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    status: getResponseStatus(error),
  });
}

function createTransformErrorResponse(error: {
  code: "input" | "script" | "core";
  message: string;
}): Response {
  return new Response(`${error.message}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    status: error.code === "core" ? 500 : 400,
  });
}

const FORWARDED_SUBSCRIPTION_HEADERS = [
  "content-disposition",
  "profile-update-interval",
  "subscription-userinfo",
  "profile-web-page-url",
] as const;

function createSubscriptionResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();

  for (const name of FORWARDED_SUBSCRIPTION_HEADERS) {
    const value = upstreamHeaders.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  headers.set("content-type", "text/yaml; charset=utf-8");

  return headers;
}

async function fetchRemoteText(
  url: string,
  userAgent?: string,
): Promise<{ headers: Headers; text: string }> {
  let response: Response;

  try {
    response = await fetch(
      url,
      userAgent
        ? {
            headers: {
              "user-agent": userAgent,
            },
          }
        : undefined,
    );
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "network",
      exitCode: EXIT_CODES.network,
      message: `Failed to fetch resource: ${url}`,
    });
  }

  if (!response.ok) {
    throw new AppError({
      code: "network",
      exitCode: EXIT_CODES.network,
      message: `Failed to fetch resource: ${url} ${response.status} ${response.statusText}`,
    });
  }

  try {
    return {
      headers: response.headers,
      text: await response.text(),
    };
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "network",
      exitCode: EXIT_CODES.network,
      message: "Failed to read fetched response body",
    });
  }
}

export async function handleWorkerRequest(
  request: Request,
  _env: WorkerEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed\n", {
      headers: {
        allow: "GET",
        "content-type": "text/plain; charset=utf-8",
      },
      status: 405,
    });
  }

  try {
    const { processorUrl, subscriptionUrl } = parseRequest(request);
    const requestUserAgent = request.headers.get("user-agent") ?? undefined;
    const [{ headers: subscriptionHeaders, text: subscriptionText }, processor] =
      await Promise.all([
      fetchRemoteText(subscriptionUrl, requestUserAgent),
      fetchRemoteText(processorUrl),
    ]);
    const result = await transformSubscription({
      processorSource: processor.text,
      subscriptionText,
    });

    if (!result.ok) {
      return createTransformErrorResponse(result.error);
    }

    return new Response(result.output, {
      headers: createSubscriptionResponseHeaders(subscriptionHeaders),
      status: 200,
    });
  } catch (error) {
    return createErrorResponse(toAppError(error));
  }
}

const cloudflareWorker = {
  fetch: handleWorkerRequest,
};

export default cloudflareWorker;
