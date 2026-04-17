import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { fixtureFiles, fixturePath, fixtureRoutes } from "./setup/fixtures.ts";
import { startWorkerE2EEnv, type WorkerE2EEnv } from "./setup/setup.ts";

let env: WorkerE2EEnv;
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

afterAll(async () => {
  await env.shutdown();
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
