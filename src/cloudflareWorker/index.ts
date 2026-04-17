import { AppError, runPipeline, toAppError } from "#core";
import type { NetworkTextInput } from "#core";

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
    const processorInput: NetworkTextInput = {
      type: "network",
      url: processorUrl,
    };
    const subscriptionInput: NetworkTextInput = {
      type: "network",
      url: subscriptionUrl,
    };
    const requestUserAgent = request.headers.get("user-agent");

    if (requestUserAgent) {
      subscriptionInput.userAgent = requestUserAgent;
    }

    const result = await runPipeline({
      processor: processorInput,
      subscription: subscriptionInput,
    });

    return new Response(result.outputYaml, {
      headers: {
        "content-type": "text/yaml; charset=utf-8",
      },
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
