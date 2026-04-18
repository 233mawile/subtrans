import { parseDocument, stringify } from "yaml";

import { AppError, EXIT_CODES } from "./appError.ts";
import type { ClashConfig } from "#processorTypes";

function isConfigObject(value: unknown): value is ClashConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseConfig(input: string): ClashConfig {
  const document = parseDocument(input, {
    prettyErrors: false,
    uniqueKeys: false,
  });

  if (document.errors.length > 0) {
    const firstError = document.errors[0];

    throw new AppError({
      code: "yaml",
      exitCode: EXIT_CODES.yaml,
      message: `Failed to parse YAML: ${firstError?.message ?? "unknown parse error"}`,
    });
  }

  const value = document.toJS();

  if (!isConfigObject(value)) {
    throw new AppError({
      code: "yaml",
      exitCode: EXIT_CODES.yaml,
      message: "YAML root must be a mapping object",
    });
  }

  return value;
}

export function dumpConfig(config: ClashConfig): string {
  try {
    return stringify(config, {
      lineWidth: 0,
    });
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "yaml",
      exitCode: EXIT_CODES.yaml,
      message: "Failed to serialize YAML output",
    });
  }
}
