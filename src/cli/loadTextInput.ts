import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { TextInput } from "#core";

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
  filename?: string,
): Promise<TextInput> {
  if (isRemoteHttpUrl(value)) {
    return {
      type: "network",
      url: value,
    };
  }

  const resolvedPath = resolve(value);
  const text = await readFile(resolvedPath, "utf8");

  return {
    filename: filename ?? resolvedPath,
    text,
    type: "source",
  };
}
