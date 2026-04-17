import { startFileServer } from "./fileServer.ts";
import { startWorkerServer } from "./workerServer.ts";

export interface WorkerE2EEnv {
  fixtureBaseUrl: string;
  fixtureUrl(pathname: string): string;
  paths: {
    workerStderrLog: string;
    workerStdoutLog: string;
  };
  shutdown(): Promise<void>;
  workerBaseUrl: string;
}

export async function startWorkerE2EEnv(): Promise<WorkerE2EEnv> {
  const fileServer = await startFileServer();
  const workerServer = await startWorkerServer();

  return {
    fixtureBaseUrl: fileServer.baseUrl,
    fixtureUrl(pathname: string) {
      return fileServer.url(pathname);
    },
    paths: {
      workerStderrLog: workerServer.stderrLogPath,
      workerStdoutLog: workerServer.stdoutLogPath,
    },
    async shutdown() {
      await workerServer.stop();
      await fileServer.stop();
    },
    workerBaseUrl: workerServer.baseUrl,
  };
}
