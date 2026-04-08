import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function isRemoteHttpUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);

    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

export function createSubscriptionFetch(
  subscriptionSource: string,
): typeof fetch | undefined {
  if (isRemoteHttpUrl(subscriptionSource)) {
    return undefined;
  }

  const resolvedPath = resolve(subscriptionSource);

  return async () => {
    const content = await readFile(resolvedPath, "utf8");

    return new Response(content, {
      headers: {
        "content-type": "text/yaml; charset=utf-8",
      },
      status: 200,
    });
  };
}
