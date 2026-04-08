import { AppError, EXIT_CODES } from "./appError.ts";

export async function fetchSubscription(
  subscriptionUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let response: Response;

  try {
    response = await fetchImpl(subscriptionUrl);
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "network",
      exitCode: EXIT_CODES.network,
      message: `Failed to fetch subscription: ${subscriptionUrl}`,
    });
  }

  if (!response.ok) {
    throw new AppError({
      code: "network",
      exitCode: EXIT_CODES.network,
      message: `Failed to fetch subscription: ${response.status} ${response.statusText}`,
    });
  }

  try {
    return await response.text();
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "network",
      exitCode: EXIT_CODES.network,
      message: "Failed to read subscription response body",
    });
  }
}
