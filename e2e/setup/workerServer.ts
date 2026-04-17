import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface WorkerServerHandle {
  baseUrl: string;
  stderrLogPath: string;
  stdoutLogPath: string;
  stop(): Promise<void>;
}

async function waitForWorker(baseUrl: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);

      if (response.status > 0) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Worker did not become ready within ${timeoutMs}ms: ${baseUrl}`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 5_000);
  });
}

export async function startWorkerServer(): Promise<WorkerServerHandle> {
  const runDir = await mkdtemp(join(tmpdir(), "subtrans-worker-e2e-"));
  const port = 18787;
  const baseUrl = `http://127.0.0.1:${port}`;
  const stdoutLogPath = join(runDir, "wrangler.stdout.log");
  const stderrLogPath = join(runDir, "wrangler.stderr.log");
  const stdout = createWriteStream(stdoutLogPath, { flags: "a" });
  const stderr = createWriteStream(stderrLogPath, { flags: "a" });

  const child = spawn(
    process.execPath,
    [
      "./node_modules/wrangler/bin/wrangler.js",
      "dev",
      "--config",
      "wrangler.jsonc",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);

  try {
    await waitForWorker(baseUrl);
  } catch (error) {
    await stopChild(child);
    throw new Error(
      [
        error instanceof Error ? error.message : String(error),
        `stdout log: ${stdoutLogPath}`,
        `stderr log: ${stderrLogPath}`,
      ].join("\n"),
    );
  }

  return {
    baseUrl,
    stderrLogPath,
    stdoutLogPath,
    async stop() {
      await stopChild(child);
      stdout.end();
      stderr.end();
    },
  };
}
