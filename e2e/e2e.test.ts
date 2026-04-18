import { readFile } from "node:fs/promises";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { parse } from "yaml";

import { fixtureFiles, fixturePath, fixtureRoutes } from "./setup/fixtures.ts";
import { startWorkerE2EEnv, type WorkerE2EEnv } from "./setup/setup.ts";

let env: WorkerE2EEnv;
let hadTestFailure = false;
const expectedFixture = await readFile(
  fixturePath(fixtureFiles.expected),
  "utf8",
);
const largeSubscriptionFixture = await readFile(
  fixturePath(fixtureFiles.largeSubscription),
  "utf8",
);

beforeAll(async () => {
  env = await startWorkerE2EEnv();
});

afterEach((context) => {
  if (context.task.result?.state === "fail") {
    hadTestFailure = true;
  }
});

afterAll(async () => {
  if (!env) {
    return;
  }

  await env.shutdown();

  if (hadTestFailure) {
    process.stderr.write(
      [
        "[worker-e2e] test failed; logs:",
        `[worker-e2e] stdout log: ${env.paths.workerStdoutLog}`,
        `[worker-e2e] stderr log: ${env.paths.workerStderrLog}`,
      ].join("\n") + "\n",
    );
  }
});

function workerUrl(params: Record<string, string>): string {
  const url = new URL(env.workerBaseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

describe("worker e2e", () => {
  it("returns transformed yaml and preserves nested fields", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.processor),
        url: env.fixtureUrl(fixtureRoutes.subscription),
      }),
    );
    const body = await response.text();
    const outputConfig = parse(body) as Record<string, unknown>;
    const expectedConfig = parse(expectedFixture) as Record<string, unknown>;
    const proxies = outputConfig.proxies as Array<Record<string, unknown>>;
    const proxyGroups = outputConfig["proxy-groups"] as Array<
      Record<string, unknown>
    >;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/yaml");
    expect(outputConfig).toEqual(expectedConfig);
    expect(outputConfig["custom-root"]).toEqual(expectedConfig["custom-root"]);
    expect(outputConfig.dns).toEqual(expectedConfig.dns);
    expect(outputConfig["proxy-providers"]).toEqual(
      expectedConfig["proxy-providers"],
    );
    expect(outputConfig["rule-providers"]).toEqual(
      expectedConfig["rule-providers"],
    );
    expect(body).toContain("[Demo]");
    expect(proxies[0]?.["plugin-opts"]).toEqual({
      host: "ws.hk.example.com",
      mode: "websocket",
    });
    expect(proxies[0]?.["client-fingerprint"]).toBe("chrome");
    expect(proxyGroups[0]?.icon).toBe("https://example.com/icon.png");
    expect(proxyGroups[0]?.hidden).toBe(true);
  });

  it("forwards only approved Clash headers from the subscription response", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.processor),
        url: env.fixtureUrl(fixtureRoutes.subscription),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/yaml; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="test.yaml"',
    );
    expect(response.headers.get("profile-update-interval")).toBe("24");
    expect(response.headers.get("subscription-userinfo")).toBe(
      "upload=1234; download=2234; total=1024000; expire=2218532293",
    );
    expect(response.headers.get("profile-web-page-url")).toBe(
      "https://example.com/profile",
    );
    expect(response.headers.get("x-subtrans-ignore")).toBeNull();
  });

  it("does not forward approved headers from the processor response", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.processor),
        url: env.fixtureUrl(fixtureRoutes.invalidYaml),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain("Failed to parse YAML");
    expect(response.headers.get("subscription-userinfo")).toBeNull();
  });

  it("passes the incoming user-agent to the subscription fetch", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.processor),
        url: env.fixtureUrl(fixtureRoutes.subscriptionRequiresCustomAgent),
      }),
      {
        headers: {
          "user-agent": "Clash.Meta/1.19.0",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(parse(await response.text())).toEqual(parse(expectedFixture));
  });

  it("processes a large subscription fixture successfully", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.processor),
        url: env.fixtureUrl(fixtureRoutes.largeSubscription),
      }),
    );
    const body = await response.text();
    const inputConfig = parse(largeSubscriptionFixture) as Record<
      string,
      unknown
    >;
    const outputConfig = parse(body) as Record<string, unknown>;
    const inputProxies = inputConfig.proxies as Array<Record<string, unknown>>;
    const outputProxies = outputConfig.proxies as Array<
      Record<string, unknown>
    >;

    expect(
      Buffer.byteLength(largeSubscriptionFixture, "utf8"),
    ).toBeGreaterThanOrEqual(50 * 1024);
    expect(response.status).toBe(200);
    expect(body).toContain("[Demo]");
    expect(outputProxies.length).toBeLessThan(inputProxies.length);
    expect(outputConfig["custom-root"]).toEqual(inputConfig["custom-root"]);
    expect(outputConfig.dns).toEqual(inputConfig.dns);
  });

  it("returns 400 when required query parameters are missing", async () => {
    const response = await fetch(env.workerBaseUrl);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      "Missing required query parameter: script",
    );
  });

  it("returns 502 when the upstream resource is missing", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.processor),
        url: env.fixtureUrl(fixtureRoutes.missing),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toContain("Failed to fetch resource");
    expect(body).toContain("404");
  });

  it("returns 400 when yaml parsing fails", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.processor),
        url: env.fixtureUrl(fixtureRoutes.invalidYaml),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain("Failed to parse YAML");
  });

  it("returns 400 when the processor does not export a default function", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.invalidProcessor),
        url: env.fixtureUrl(fixtureRoutes.subscription),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain("Processor must export a default function");
  });

  it("returns 400 when the processor throws", async () => {
    const response = await fetch(
      workerUrl({
        script: env.fixtureUrl(fixtureRoutes.throwingProcessor),
        url: env.fixtureUrl(fixtureRoutes.subscription),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain("Processor execution failed:");
    expect(body).toContain("fixture processor failed");
  });

  it("returns 405 for non-get requests", async () => {
    const response = await fetch(env.workerBaseUrl, {
      method: "POST",
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
