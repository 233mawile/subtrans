import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { AppError, EXIT_CODES } from "./appError.ts";

export interface ProcessorSource {
  source: string;
  sourcePath: string;
}

export async function loadProcessorSource(
  processorPath: string,
): Promise<ProcessorSource> {
  const resolvedPath = resolve(processorPath);

  try {
    await access(resolvedPath);
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "processorLoad",
      exitCode: EXIT_CODES.processorLoad,
      message: `Processor file not found: ${resolvedPath}`,
    });
  }

  try {
    const source = await readFile(resolvedPath, "utf8");

    return {
      source,
      sourcePath: resolvedPath,
    };
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "processorLoad",
      exitCode: EXIT_CODES.processorLoad,
      message: `Failed to read processor file: ${resolvedPath}`,
    });
  }
}
