import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { AppError, EXIT_CODES } from "#core";

export async function writeOutput(
  content: string,
  outputPath?: string,
): Promise<void> {
  if (!outputPath) {
    process.stdout.write(content);
    return;
  }

  const resolvedPath = resolve(outputPath);

  try {
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, content, "utf8");
  } catch (error) {
    throw new AppError({
      code: "output",
      cause: error,
      exitCode: EXIT_CODES.output,
      message: `Failed to write output: ${resolvedPath}`,
    });
  }
}
