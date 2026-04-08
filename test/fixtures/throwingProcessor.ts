import type { ClashConfig } from "#processorTypes";

export default function processClashConfig(_config: ClashConfig): ClashConfig {
  throw new Error("fixture processor failed");
}
