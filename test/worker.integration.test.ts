import { AppError, EXIT_CODES } from "#core";
import type { RunPipelineInput, RunPipelineResult } from "#core";
import { exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

const { runPipelineMock } = vi.hoisted(() => ({
  runPipelineMock:
    vi.fn<(input: RunPipelineInput) => Promise<RunPipelineResult>>(),
}));

vi.mock("#core", async () => {
  const actual = await import("../src/core/appError.ts");

  return {
    ...actual,
    runPipeline: runPipelineMock,
  };
});

const subscriptionUrl = "https://fixtures.test/subscription.yaml";
const processorUrl = "https://fixtures.test/processor.js";

afterEach(() => {
  runPipelineMock.mockReset();
  vi.restoreAllMocks();
});

describe("worker integration", () => {
  it("passes network inputs into core and returns yaml output", async () => {
    runPipelineMock.mockResolvedValue({
      outputYaml: "proxies:\n  - name: '[Worker] hk'\n",
    });

    const response = await exports.default.fetch(
      `https://worker.test/?url=${encodeURIComponent(subscriptionUrl)}&script=${encodeURIComponent(processorUrl)}`,
    );

    expect(runPipelineMock).toHaveBeenCalledWith({
      processor: {
        type: "network",
        url: processorUrl,
      },
      subscription: {
        type: "network",
        url: subscriptionUrl,
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/yaml");
    expect(await response.text()).toContain("[Worker] hk");
  });

  it("passes the incoming request user-agent header into the subscription fetch", async () => {
    runPipelineMock.mockResolvedValue({
      outputYaml: "proxies:\n  - name: '[Worker] hk'\n",
    });

    const response = await exports.default.fetch(
      new Request(
        `https://worker.test/?url=${encodeURIComponent(subscriptionUrl)}&script=${encodeURIComponent(processorUrl)}`,
        {
          headers: {
            "user-agent": "Clash.Meta/1.19.0",
          },
        },
      ),
    );

    expect(runPipelineMock).toHaveBeenCalledWith({
      processor: {
        type: "network",
        url: processorUrl,
      },
      subscription: {
        type: "network",
        url: subscriptionUrl,
        userAgent: "Clash.Meta/1.19.0",
      },
    });
    expect(response.status).toBe(200);
  });

  it("returns 400 when required query parameters are missing", async () => {
    const response = await exports.default.fetch("https://worker.test/");

    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      "Missing required query parameter: script",
    );
  });

  it("maps core network failures to 502 responses", async () => {
    runPipelineMock.mockRejectedValue(
      new AppError({
        code: "network",
        exitCode: EXIT_CODES.network,
        message: "Failed to fetch resource: 404 Not Found",
      }),
    );

    const response = await exports.default.fetch(
      `https://worker.test/?url=${encodeURIComponent(subscriptionUrl)}&script=${encodeURIComponent(processorUrl)}`,
    );

    expect(response.status).toBe(502);
    expect(await response.text()).toContain(
      "Failed to fetch resource: 404 Not Found",
    );
  });

  it("returns 405 for non-get requests", async () => {
    const response = await exports.default.fetch(
      new Request("https://worker.test/", {
        method: "POST",
      }),
    );

    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
