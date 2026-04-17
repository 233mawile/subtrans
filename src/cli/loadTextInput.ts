import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { NetworkTextInput, TextInput } from "#core";

interface LoadTextInputOptions {
  filename?: string;
  userAgent?: string;
}

function isRemoteHttpUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);

    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

export async function loadTextInput(
  value: string,
  options: LoadTextInputOptions = {},
): Promise<TextInput> {
  if (isRemoteHttpUrl(value)) {
    const networkInput: NetworkTextInput = {
      type: "network",
      url: value,
    };

    if (options.userAgent) {
      networkInput.userAgent = options.userAgent;
    }

    return networkInput;
  }

  const resolvedPath = resolve(value);
  const text = await readFile(resolvedPath, "utf8");

  return {
    filename: options.filename ?? resolvedPath,
    text,
    type: "source",
  };
}
