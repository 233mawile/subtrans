# Worker E2E Test Redesign

## Context

This project currently has two test styles:

- CLI integration tests in [test/cli.integration.test.ts](/home/mawile/develop/subtrans/test/cli.integration.test.ts:1)
- Worker integration tests in [test/worker.integration.test.ts](/home/mawile/develop/subtrans/test/worker.integration.test.ts:1)

The current Worker test is not a true end-to-end test. It runs inside the Vitest Cloudflare worker pool and mocks `#core.runPipeline`, so it verifies request adaptation and error mapping but does not exercise:

- a real `wrangler dev` process
- real network fetches for subscription and processor assets
- real QuickJS processor execution
- real stdout/stderr logs from the dev server

Before removing CLI mode, we want to reshape Worker testing around the runtime that will remain: the real development server.

## Goal

Replace the current Worker integration test with a black-box end-to-end test suite that:

- starts a real `wrangler dev` process
- redirects server logs to temporary files
- starts a real local file server for test fixtures
- drives the Worker only through HTTP requests
- validates observable behavior instead of internal calls

## Non-Goals

- Do not preserve direct assertions about whether `runPipeline()` was called with a specific object
- Do not redesign Worker production behavior as part of this spec
- Do not migrate or rewrite CLI tests in this phase
- Do not introduce a generic cross-project E2E framework

## Design Principles

- Test the public behavior, not implementation details
- Keep environment orchestration separate from test assertions
- Reuse one Worker dev environment per test file for speed and stability
- Make failures diagnosable by preserving server logs
- Keep naming simple and local to this repository; prefer `setup` over `harness`

## Approaches Considered

### Approach 1: Inline setup in a single test file

Put all process spawning, file server startup, health checks, and cleanup directly into one Vitest file.

Pros:

- fastest to start
- lowest file count

Cons:

- test code becomes operational glue code
- hard to extend when more cases or diagnostics are added
- encourages duplicated logic as the suite grows

### Approach 2: Modular E2E setup layer

Create a small `test/e2e` support layer that owns environment startup and cleanup, while the test file stays focused on behavior.

Pros:

- clean separation between environment control and assertions
- easy to add new cases without reworking process code
- easier to preserve logs, ports, temp paths, and helper APIs in one place

Cons:

- requires a few extra files
- slightly more up-front structure

### Approach 3: External shell/script driven environment

Start `wrangler dev` and the fixture server outside Vitest via scripts, then let tests attach to pre-existing endpoints.

Pros:

- very thin test code

Cons:

- fragmented lifecycle management
- harder to diagnose failures
- weaker coupling with Vitest setup/teardown flow

## Recommendation

Use Approach 2: a modular E2E setup layer.

This is the best fit because the project is intentionally replacing a mock-style Worker integration test with a durable black-box test foundation. A small local setup layer keeps the suite understandable now and flexible after CLI removal.

## Target Structure

Recommended files:

- [test/e2e/setup.ts](/home/mawile/develop/subtrans/test/e2e/setup.ts)
- [test/e2e/workerServer.ts](/home/mawile/develop/subtrans/test/e2e/workerServer.ts)
- [test/e2e/fileServer.ts](/home/mawile/develop/subtrans/test/e2e/fileServer.ts)
- [test/e2e/fixtures.ts](/home/mawile/develop/subtrans/test/e2e/fixtures.ts)
- [test/worker.e2e.test.ts](/home/mawile/develop/subtrans/test/worker.e2e.test.ts)

The existing [test/worker.integration.test.ts](/home/mawile/develop/subtrans/test/worker.integration.test.ts:1) will be removed or renamed as part of the implementation so the Worker test suite is defined by the new black-box E2E file.

## Component Design

### `test/e2e/workerServer.ts`

Responsibilities:

- allocate a port for `wrangler dev`
- create a temporary directory for run artifacts
- spawn the real `wrangler dev` child process
- redirect `stdout` and `stderr` to dedicated log files
- wait for the Worker endpoint to become reachable
- expose shutdown logic

Expected API shape:

```ts
interface WorkerServerHandle {
  baseUrl: string;
  stdoutLogPath: string;
  stderrLogPath: string;
  stop(): Promise<void>;
}
```

Notes:

- readiness should be based on HTTP reachability, not only process output text
- the implementation should use a timeout and fail with log file paths included in the error
- logs should be preserved at least on failure; keeping them always is acceptable if that simplifies cleanup

### `test/e2e/fileServer.ts`

Responsibilities:

- start a real local HTTP server for fixtures
- serve fixture files such as subscription YAML and processor JS
- provide explicit routes for error scenarios
- expose shutdown logic

Expected behavior:

- normal fixture routes return files from `test/fixtures`
- special routes can simulate `404`, invalid YAML, or other controlled failures
- route behavior should be deterministic and easy to reference from tests

Expected API shape:

```ts
interface FileServerHandle {
  baseUrl: string;
  url(pathname: string): string;
  stop(): Promise<void>;
}
```

### `test/e2e/fixtures.ts`

Responsibilities:

- define fixture file names and route helpers in one place
- avoid scattering hard-coded URLs across tests

Example responsibilities:

- map `"subscription.yaml"` to a served URL
- provide helpers for known failure routes
- optionally expose semantic names such as `subscriptionUrl()` and `processorUrl()`

### `test/e2e/setup.ts`

Responsibilities:

- compose the fixture server and Worker server
- start them in the correct order
- return one unified environment object for tests
- perform shared teardown

Expected API shape:

```ts
interface WorkerE2EEnv {
  workerBaseUrl: string;
  fixtureBaseUrl: string;
  fixtureUrl(pathname: string): string;
  paths: {
    workerStdoutLog: string;
    workerStderrLog: string;
  };
  shutdown(): Promise<void>;
}
```

Lifecycle:

- created once in `beforeAll`
- reused by all test cases in the file
- disposed in `afterAll`

### `test/worker.e2e.test.ts`

Responsibilities:

- issue HTTP requests to the real Worker dev server
- build query strings using fixture server URLs
- assert status codes, headers, and response bodies
- print or surface log locations when startup or requests fail

This file should not:

- mock `#core`
- import `cloudflare:workers`
- assert internal call payloads

## Test Scope

The new E2E suite should replace the current Worker test coverage with behavior-based cases.

### Required cases

1. Successful request returns `200` and YAML output
2. Request `user-agent` affects subscription fetch behavior
3. Missing required query parameters returns `400`
4. Upstream fetch failure is surfaced as an error response
5. Non-`GET` requests return `405`

### Nice-to-have follow-up cases

- invalid YAML from the fixture server
- processor script without a valid default export
- processor runtime failure

These are valuable but not required for the first pass if they noticeably slow the first implementation.

## Behavior Mapping From Old Test Suite

The following current expectations remain, but in black-box form:

- request query parameters determine Worker behavior
- incoming `user-agent` changes subscription fetch behavior
- Worker returns the expected HTTP status family for usage, method, and upstream errors

The following expectations are intentionally dropped:

- exact `runPipeline()` call shape
- direct mocking of core errors inside the Worker test

That loss of internal visibility is expected and correct for true E2E coverage.

## Logging and Diagnostics

Each test run should produce temporary log files for:

- Worker stdout
- Worker stderr

On startup failure or timeout, the thrown error should include:

- the Worker base URL if known
- the log file paths
- a short reason such as "worker did not become ready within timeout"

This is important because replacing in-process tests with real `wrangler dev` adds more moving pieces and makes log preservation part of the test design, not a debugging afterthought.

## Ports and Isolation

Requirements:

- use dynamically selected local ports
- avoid hard-coded ports in test code
- isolate temporary run artifacts per test process

One environment per file is sufficient for now. Per-test isolation is not needed unless later cases prove the Worker holds cross-test state.

## Impact on Existing Configuration

Expected implementation-side changes after this spec is approved:

- replace [vitest.worker.config.ts](/home/mawile/develop/subtrans/vitest.worker.config.ts:1) with a normal Vitest config for Node-based black-box E2E execution, or retire it if the main config can own the new suite cleanly
- update `package.json` test scripts so the Worker suite runs the new E2E file instead of the current Cloudflare pool based test
- stop depending on `cloudflare:workers` inside Worker tests

This spec does not require choosing the exact final Vitest config filename yet, but the implementation must remove reliance on the current in-process Worker test mode.

## Risks

### Slower test runtime

Starting real processes will be slower than the current mocked test. Reusing one environment per file is the main mitigation.

### Flaky readiness checks

If readiness depends on parsing console output, the suite may become fragile. The design avoids that by preferring HTTP-based readiness probing.

### Harder failure diagnosis

Real E2E failures are noisier than mocked failures. Preserved stdout/stderr logs are the mitigation.

### Fixture server complexity growth

If too many custom routes are embedded ad hoc, the file server can become messy. Keeping route helpers centralized in `fixtures.ts` and `fileServer.ts` limits that risk.

## Success Criteria

The redesign is successful when:

- the Worker test suite runs against a real `wrangler dev` process
- the suite no longer mocks `#core`
- the file server provides the inputs the Worker fetches during tests
- existing Worker behavior coverage is preserved through external HTTP assertions
- failures surface enough log information to debug startup or routing problems quickly

## Implementation Boundary

This spec covers only the redesign of Worker end-to-end testing as preparation for removing CLI mode. The actual CLI removal, and any test migration caused by that change, should be planned separately after this E2E foundation is in place.
