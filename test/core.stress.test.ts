import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { runPipeline } from "#core";

const largeSubscriptionPath = fileURLToPath(
  new URL("./fixtures/largeSubscription.yaml", import.meta.url),
);
const processorPath = fileURLToPath(
  new URL("./fixtures/processor.js", import.meta.url),
);

describe("core stress", () => {
  it("processes a ~50KB subscription successfully inside the sandbox", async () => {
    const [fixtureStats, fixtureText] = await Promise.all([
      stat(largeSubscriptionPath),
      readFile(largeSubscriptionPath, "utf8"),
    ]);

    expect(fixtureStats.size).toBeGreaterThanOrEqual(50 * 1024);
    expect(fixtureStats.size).toBeLessThan(60 * 1024);

    const result = await runPipeline({
      fetchImpl: async () =>
        new Response(fixtureText, {
          headers: {
            "content-type": "text/yaml; charset=utf-8",
          },
          status: 200,
        }),
      processorPath,
      subscriptionUrl: "https://stress.example.com/subscription.yaml",
    });

    const inputConfig = parse(fixtureText) as Record<string, unknown>;
    const outputConfig = parse(result.outputYaml) as Record<string, unknown>;
    const inputProxies = inputConfig.proxies as Array<Record<string, unknown>>;
    const outputProxies = outputConfig.proxies as Array<
      Record<string, unknown>
    >;

    expect(result.outputYaml).toContain("[Demo]");
    expect(outputProxies.length).toBeLessThan(inputProxies.length);
    expect(outputConfig["custom-root"]).toEqual(inputConfig["custom-root"]);
    expect(outputConfig.dns).toEqual(inputConfig.dns);
  }, 30000);
});
