import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const fixturesDir = fileURLToPath(
  new URL("../fixtures/", import.meta.url).href,
);

export const fixtureFiles = {
  expected: "expected.yaml",
  invalidProcessor: "invalidProcessor.js",
  invalidYaml: "invalidYaml.txt",
  largeSubscription: "largeSubscription.yaml",
  processor: "processor.js",
  subscription: "subscription.yaml",
  throwingProcessor: "throwingProcessor.js",
} as const;

export const fixtureRoutes = {
  invalidProcessor: "/invalidProcessor.js",
  invalidYaml: "/invalid-yaml",
  largeSubscription: "/large-subscription.yaml",
  missing: "/missing",
  processor: "/processor.js",
  subscription: "/subscription.yaml",
  subscriptionRequiresCustomAgent: "/subscription-requires-custom-agent",
  subscriptionRequiresDefaultAgent: "/subscription-requires-default-agent",
  throwingProcessor: "/throwingProcessor.js",
} as const;

export function fixturePath(
  name: (typeof fixtureFiles)[keyof typeof fixtureFiles],
): string {
  return join(fixturesDir, name);
}
