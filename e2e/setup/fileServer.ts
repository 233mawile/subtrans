import { createServer, type IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";

import { fixtureFiles, fixturePath, fixtureRoutes } from "./fixtures.ts";

export const DEFAULT_USER_AGENT = "clash-verge/v2.4.7";

const SUBSCRIPTION_RESPONSE_HEADERS = {
  "content-disposition": 'attachment; filename="test.yaml"',
  "profile-update-interval": "24",
  "subscription-userinfo":
    "upload=1234; download=2234; total=1024000; expire=2218532293",
  "profile-web-page-url": "https://example.com/profile",
  "x-subtrans-ignore": "ignore-me",
} as const;

const PROCESSOR_RESPONSE_HEADERS = {
  "content-type": "text/javascript; charset=utf-8",
  "subscription-userinfo":
    "upload=999; download=999; total=999; expire=999",
} as const;

export interface FileServerHandle {
  baseUrl: string;
  stop(): Promise<void>;
  url(pathname: string): string;
}

function getUserAgentHeader(request: IncomingMessage): string | undefined {
  const value = request.headers["user-agent"];

  return Array.isArray(value) ? value[0] : value;
}

export async function startFileServer(): Promise<FileServerHandle> {
  const subscriptionFixture = await readFile(
    fixturePath(fixtureFiles.subscription),
    "utf8",
  );
  const processorFixture = await readFile(
    fixturePath(fixtureFiles.processor),
    "utf8",
  );
  const invalidYamlFixture = await readFile(
    fixturePath(fixtureFiles.invalidYaml),
    "utf8",
  );
  const largeSubscriptionFixture = await readFile(
    fixturePath(fixtureFiles.largeSubscription),
    "utf8",
  );
  const invalidProcessorFixture = await readFile(
    fixturePath(fixtureFiles.invalidProcessor),
    "utf8",
  );
  const throwingProcessorFixture = await readFile(
    fixturePath(fixtureFiles.throwingProcessor),
    "utf8",
  );

  const server = createServer((request, response) => {
    switch (request.url) {
      case fixtureRoutes.subscription:
        response.writeHead(200, {
          "content-type": "text/yaml; charset=utf-8",
          ...SUBSCRIPTION_RESPONSE_HEADERS,
        });
        response.end(subscriptionFixture);
        return;
      case fixtureRoutes.processor:
        response.writeHead(200, PROCESSOR_RESPONSE_HEADERS);
        response.end(processorFixture);
        return;
      case fixtureRoutes.invalidYaml:
        response.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end(invalidYamlFixture);
        return;
      case fixtureRoutes.largeSubscription:
        response.writeHead(200, { "content-type": "text/yaml; charset=utf-8" });
        response.end(largeSubscriptionFixture);
        return;
      case fixtureRoutes.invalidProcessor:
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
        });
        response.end(invalidProcessorFixture);
        return;
      case fixtureRoutes.throwingProcessor:
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
        });
        response.end(throwingProcessorFixture);
        return;
      case fixtureRoutes.subscriptionRequiresDefaultAgent:
        if (getUserAgentHeader(request) !== DEFAULT_USER_AGENT) {
          response.writeHead(404, {
            "content-type": "text/plain; charset=utf-8",
          });
          response.end("Not Found");
          return;
        }

        response.writeHead(200, {
          "content-type": "text/yaml; charset=utf-8",
          ...SUBSCRIPTION_RESPONSE_HEADERS,
        });
        response.end(subscriptionFixture);
        return;
      case fixtureRoutes.subscriptionRequiresCustomAgent:
        if (getUserAgentHeader(request) !== "Clash.Meta/1.19.0") {
          response.writeHead(404, {
            "content-type": "text/plain; charset=utf-8",
          });
          response.end("Not Found");
          return;
        }

        response.writeHead(200, {
          "content-type": "text/yaml; charset=utf-8",
          ...SUBSCRIPTION_RESPONSE_HEADERS,
        });
        response.end(subscriptionFixture);
        return;
      default:
        response.writeHead(404, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("Not Found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
    url(pathname: string) {
      return new URL(pathname, baseUrl).toString();
    },
  };
}
