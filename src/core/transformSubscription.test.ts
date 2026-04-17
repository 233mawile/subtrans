import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureFiles, fixturePath } from "../../e2e/setup/fixtures.ts";
import { transformSubscription } from "./transformSubscription.ts";
import * as yamlCodec from "./yamlCodec.ts";

const subscriptionText = await readFile(
  fixturePath(fixtureFiles.subscription),
  "utf8",
);
const expectedOutput = await readFile(
  fixturePath(fixtureFiles.expected),
  "utf8",
);
const invalidYamlText = await readFile(
  fixturePath(fixtureFiles.invalidYaml),
  "utf8",
);
const processorSource = await readFile(
  fixturePath(fixtureFiles.processor),
  "utf8",
);
const invalidProcessorSource = await readFile(
  fixturePath(fixtureFiles.invalidProcessor),
  "utf8",
);
const throwingProcessorSource = await readFile(
  fixturePath(fixtureFiles.throwingProcessor),
  "utf8",
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("transformSubscription", () => {
  it("returns transformed output for valid texts", async () => {
    const result = await transformSubscription({
      processorSource,
      subscriptionText,
    });

    expect(result).toEqual({
      ok: true,
      output: expectedOutput,
    });
  });

  it("returns an input error when subscription yaml is invalid", async () => {
    const result = await transformSubscription({
      processorSource,
      subscriptionText: invalidYamlText,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "input",
      },
    });
    expect(result.ok ? "" : result.error.message).toContain("Failed to parse YAML");
  });

  it("returns a script error when the processor has no default export", async () => {
    const result = await transformSubscription({
      processorSource: invalidProcessorSource,
      subscriptionText,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "script",
        message: "Processor must export a default function",
      },
    });
  });

  it("returns a script error when the processor throws", async () => {
    const result = await transformSubscription({
      processorSource: throwingProcessorSource,
      subscriptionText,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "script",
      },
    });
    expect(result.ok ? "" : result.error.message).toContain(
      "Processor execution failed:",
    );
  });

  it("falls back to a core error when serialization throws unexpectedly", async () => {
    vi.spyOn(yamlCodec, "dumpConfig").mockImplementation(() => {
      throw new Error("serialize boom");
    });

    const result = await transformSubscription({
      processorSource,
      subscriptionText,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "core",
        message: "serialize boom",
        cause: {
          message: "serialize boom",
          name: "Error",
        },
      },
    });
    expect(result.ok ? null : result.error.cause).not.toBeInstanceOf(Error);
  });
});
