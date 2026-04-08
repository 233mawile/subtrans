import type { ClashConfig } from "./clashTypes.ts";

export type Processor = (
  config: ClashConfig,
) => ClashConfig | Promise<ClashConfig>;
