import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

interface CliResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixturesDir = fileURLToPath(new URL("./fixtures/", import.meta.url));

const subscriptionFixture = await readFile(
  join(fixturesDir, "subscription.yaml"),
  "utf8",
);
const invalidYamlFixture = await readFile(
  join(fixturesDir, "invalidYaml.txt"),
  "utf8",
);
const expectedFixture = await readFile(
  join(fixturesDir, "expected.yaml"),
  "utf8",
);

let baseUrl = "";
let server: ReturnType<typeof createServer>;

async function runCli(args: string[]): Promise<CliResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [".", ...args], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode,
        stderr,
        stdout,
      });
    });
  });
}

beforeAll(async () => {
  server = createServer((request, response) => {
    switch (request.url) {
      case "/subscription.yaml":
        response.writeHead(200, { "content-type": "text/yaml; charset=utf-8" });
        response.end(subscriptionFixture);
        return;
      case "/invalid-yaml":
        response.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end(invalidYamlFixture);
        return;
      default:
        response.writeHead(404, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("Not Found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

describe("cli integration", () => {
  it("writes transformed yaml to stdout and preserves unknown fields across nesting levels", async () => {
    const result = await runCli([
      "--url",
      `${baseUrl}/subscription.yaml`,
      "--script",
      "./test/fixtures/processor.ts",
    ]);

    const outputConfig = parse(result.stdout) as Record<string, unknown>;
    const expectedConfig = parse(expectedFixture) as Record<string, unknown>;

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(outputConfig).toEqual(expectedConfig);
    expect(outputConfig["custom-root"]).toEqual(expectedConfig["custom-root"]);
    expect(outputConfig.dns).toEqual(expectedConfig.dns);
    expect(outputConfig["proxy-providers"]).toEqual(
      expectedConfig["proxy-providers"],
    );
    expect(outputConfig["rule-providers"]).toEqual(
      expectedConfig["rule-providers"],
    );

    const proxies = outputConfig.proxies as Array<Record<string, unknown>>;
    const proxyGroups = outputConfig["proxy-groups"] as Array<
      Record<string, unknown>
    >;

    expect(proxies[0]?.["plugin-opts"]).toEqual({
      host: "ws.hk.example.com",
      mode: "websocket",
    });
    expect(proxies[0]?.["client-fingerprint"]).toBe("chrome");
    expect(proxyGroups[0]?.icon).toBe("https://example.com/icon.png");
    expect(proxyGroups[0]?.hidden).toBe(true);
  });

  it("writes transformed yaml to a file when out is provided", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "subtrans-"));
    const outputPath = join(tempDir, "output.yaml");

    const result = await runCli([
      "--url",
      `${baseUrl}/subscription.yaml`,
      "--script",
      "./test/fixtures/processor.ts",
      "--out",
      outputPath,
    ]);

    const outputContent = await readFile(outputPath, "utf8");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(parse(outputContent)).toEqual(parse(expectedFixture));
  });

  it("fails when required arguments are missing", async () => {
    const result = await runCli([]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing required argument: --url");
  });

  it("fails when the subscription fetch returns a non-ok response", async () => {
    const result = await runCli([
      "--url",
      `${baseUrl}/missing`,
      "--script",
      "./test/fixtures/processor.ts",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "Failed to fetch subscription: 404 Not Found",
    );
  });

  it("fails when yaml parsing fails", async () => {
    const result = await runCli([
      "--url",
      `${baseUrl}/invalid-yaml`,
      "--script",
      "./test/fixtures/processor.ts",
    ]);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Failed to parse YAML");
  });

  it("fails when the processor does not export the required default function", async () => {
    const result = await runCli([
      "--url",
      `${baseUrl}/subscription.yaml`,
      "--script",
      "./test/fixtures/invalidProcessor.ts",
    ]);

    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain("Processor must export a default function");
  });

  it("fails when the processor throws", async () => {
    const result = await runCli([
      "--url",
      `${baseUrl}/subscription.yaml`,
      "--script",
      "./test/fixtures/throwingProcessor.ts",
    ]);

    expect(result.exitCode).toBe(5);
    expect(result.stderr).toContain("Processor execution failed");
    expect(result.stderr).toContain("fixture processor failed");
  });
});
