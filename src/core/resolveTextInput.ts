import { AppError, EXIT_CODES } from "./appError.ts";
import type { TextInput } from "./coreTypes.ts";

export async function resolveTextInput(
  input: TextInput,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (input.type === "source") {
    return input.text;
  }

  let response: Response;
  const requestInit = input.userAgent
    ? {
        headers: {
          "user-agent": input.userAgent,
        },
      }
    : undefined;

  try {
    response = await fetchImpl(input.url, requestInit);
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "network",
      exitCode: EXIT_CODES.network,
      message: `Failed to fetch resource: ${input.url}`,
    });
  }

  if (!response.ok) {
    throw new AppError({
      code: "network",
      exitCode: EXIT_CODES.network,
      message: `Failed to fetch resource: ${input.url} ${response.status} ${response.statusText}`,
    });
  }

  try {
    return await response.text();
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "network",
      exitCode: EXIT_CODES.network,
      message: "Failed to read fetched response body",
    });
  }
}
