import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { AppError, EXIT_CODES } from "./appError.ts";
import type { Processor } from "../processorTypes/index.ts";
import type { ProcessorModule } from "./coreTypes.ts";

export async function loadProcessor(processorPath: string): Promise<Processor> {
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

  let module: ProcessorModule;

  try {
    module = (await import(
      pathToFileURL(resolvedPath).href
    )) as ProcessorModule;
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "processorLoad",
      exitCode: EXIT_CODES.processorLoad,
      message: `Failed to load processor: ${resolvedPath}`,
    });
  }

  if (typeof module.default !== "function") {
    throw new AppError({
      code: "processorLoad",
      exitCode: EXIT_CODES.processorLoad,
      message: "Processor must export a default function",
    });
  }

  return module.default as Processor;
}
